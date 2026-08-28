use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use tower_sessions::Session;
use validator::Validate;

use crate::{
    auth::{hash_password, verify_password},
    models::{user, LoginRequest, RegisterRequest},
    AppState,
};

pub const SESSION_USER_ID_KEY: &str = "user_id";

/// Log the real error, return a fixed product message: raw DB/session error
/// text (constraint names, SQL fragments) must never reach the response body.
fn internal_error<E: std::fmt::Display>(context: &'static str) -> impl FnOnce(E) -> (StatusCode, String) {
    move |error| {
        tracing::error!("{}: {}", context, error);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Something went wrong. Please try again.".to_string(),
        )
    }
}

fn is_unique_violation(error: &sqlx::Error) -> bool {
    matches!(error, sqlx::Error::Database(db) if db.is_unique_violation())
}

/// 注册新用户
pub async fn register(
    State(state): State<AppState>,
    session: Session,
    Json(req): Json<RegisterRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let req = req.normalized();

    // 验证输入
    req.validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Validation error: {}", e)))?;

    // 检查 handle 是否已存在
    if let Some(_) = user::find_user_by_handle(&state.db, &req.handle)
        .await
        .map_err(internal_error("register: handle lookup"))?
    {
        return Err((
            StatusCode::CONFLICT,
            "Handle already exists".to_string(),
        ));
    }

    // 检查 email 是否已存在
    if let Some(_) = user::find_user_by_email(&state.db, &req.email)
        .await
        .map_err(internal_error("register: email lookup"))?
    {
        return Err((StatusCode::CONFLICT, "Email already exists".to_string()));
    }

    // 哈希密码
    let password_hash = hash_password(&req.password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    // 创建用户。上面的 check-then-insert 存在并发窗口：撞 UNIQUE 约束时
    // 映射为 409，而不是把 duplicate key 原文当 500 返回。
    let user = match user::create_user(
        &state.db,
        &req.handle,
        &req.email,
        &password_hash,
        &req.display_name,
    )
    .await
    {
        Ok(user) => user,
        Err(err) if is_unique_violation(&err) => {
            return Err((
                StatusCode::CONFLICT,
                "Handle or email already exists".to_string(),
            ));
        }
        Err(err) => return Err(internal_error("register: create user")(err)),
    };

    // 会话固定防御：跨越认证边界时轮换 session id。
    session
        .cycle_id()
        .await
        .map_err(internal_error("register: session rotate"))?;

    // Keep frontend state and backend session in sync after successful signup.
    session
        .insert(SESSION_USER_ID_KEY, user.id)
        .await
        .map_err(internal_error("register: session insert"))?;

    let created_at: chrono::DateTime<chrono::Utc> = sqlx::query_scalar(
        "SELECT created_at FROM users WHERE id = $1",
    )
    .bind(user.id)
    .fetch_one(&state.db)
    .await
    .map_err(internal_error("register: created_at lookup"))?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "id": user.id,
            "handle": user.handle,
            "email": user.email,
            "display_name": user.display_name,
            "role": user.role,
            "created_at": created_at.to_rfc3339(),
        })),
    ))
}

/// 用户登录
pub async fn login(
    State(state): State<AppState>,
    session: Session,
    Json(req): Json<LoginRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let req = req.normalized();

    // 验证输入
    req.validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Validation error: {}", e)))?;

    // 查找用户
    let user = user::find_user_by_handle(&state.db, &req.handle)
        .await
        .map_err(internal_error("login: user lookup"))?
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()))?;

    // 验证密码
    let is_valid = verify_password(&req.password, &user.password_hash)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    if !is_valid {
        return Err((StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()));
    }

    // 会话固定防御：跨越认证边界时轮换 session id。
    session
        .cycle_id()
        .await
        .map_err(internal_error("login: session rotate"))?;

    // 设置 session
    session
        .insert(SESSION_USER_ID_KEY, user.id)
        .await
        .map_err(internal_error("login: session insert"))?;

    let created_at: chrono::DateTime<chrono::Utc> = sqlx::query_scalar(
        "SELECT created_at FROM users WHERE id = $1",
    )
    .bind(user.id)
    .fetch_one(&state.db)
    .await
    .map_err(internal_error("login: created_at lookup"))?;

    Ok(Json(json!({
        "id": user.id,
        "handle": user.handle,
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
        "created_at": created_at.to_rfc3339(),
    })))
}

/// 用户登出
pub async fn logout(session: Session) -> Result<impl IntoResponse, (StatusCode, String)> {
    session
        .delete()
        .await
        .map_err(internal_error("logout: session delete"))?;

    Ok(Json(json!({ "message": "Logged out successfully" })))
}

/// 获取当前用户信息
pub async fn me(
    State(state): State<AppState>,
    session: Session,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // 从 session 获取 user_id
    let user_id: i64 = session
        .get(SESSION_USER_ID_KEY)
        .await
        .map_err(internal_error("me: session read"))?
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Not authenticated".to_string()))?;

    // 查询用户（含 created_at 供前端 Profile join date）。
    // 账号已被删除时残留会话按未认证处理，而不是 500。
    let row = sqlx::query(
        r#"
        SELECT id, handle, email, display_name, role::text AS role, created_at
        FROM users
        WHERE id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(internal_error("me: user lookup"))?
    .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Not authenticated".to_string()))?;

    use sqlx::Row;
    let created_at: chrono::DateTime<chrono::Utc> = row
        .try_get("created_at")
        .map_err(internal_error("me: created_at column"))?;

    Ok(Json(json!({
        "id": row.try_get::<i64, _>("id").map_err(internal_error("me: id column"))?,
        "handle": row.try_get::<String, _>("handle").map_err(internal_error("me: handle column"))?,
        "email": row.try_get::<String, _>("email").map_err(internal_error("me: email column"))?,
        "display_name": row.try_get::<String, _>("display_name").map_err(internal_error("me: display_name column"))?,
        "role": row.try_get::<String, _>("role").map_err(internal_error("me: role column"))?,
        "created_at": created_at.to_rfc3339(),
    })))
}
