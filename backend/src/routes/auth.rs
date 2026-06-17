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
    models::{user, LoginRequest, RegisterRequest, User},
    AppState,
};

pub const SESSION_USER_ID_KEY: &str = "user_id";

/// 注册新用户
pub async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // 验证输入
    req.validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Validation error: {}", e)))?;

    // 检查 handle 是否已存在
    if let Some(_) = user::find_user_by_handle(&state.db, &req.handle)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    {
        return Err((
            StatusCode::CONFLICT,
            "Handle already exists".to_string(),
        ));
    }

    // 检查 email 是否已存在
    if let Some(_) = user::find_user_by_email(&state.db, &req.email)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    {
        return Err((StatusCode::CONFLICT, "Email already exists".to_string()));
    }

    // 哈希密码
    let password_hash = hash_password(&req.password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    // 创建用户
    let user = user::create_user(
        &state.db,
        &req.handle,
        &req.email,
        &password_hash,
        &req.display_name,
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "id": user.id,
            "handle": user.handle,
            "email": user.email,
            "display_name": user.display_name,
            "role": user.role,
        })),
    ))
}

/// 用户登录
pub async fn login(
    State(state): State<AppState>,
    session: Session,
    Json(req): Json<LoginRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // 验证输入
    req.validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Validation error: {}", e)))?;

    // 查找用户
    let user = user::find_user_by_handle(&state.db, &req.handle)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()))?;

    // 验证密码
    let is_valid = verify_password(&req.password, &user.password_hash)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    if !is_valid {
        return Err((StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()));
    }

    // 设置 session
    session
        .insert(SESSION_USER_ID_KEY, user.id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "id": user.id,
        "handle": user.handle,
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
    })))
}

/// 用户登出
pub async fn logout(session: Session) -> Result<impl IntoResponse, (StatusCode, String)> {
    session
        .delete()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

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
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Not authenticated".to_string()))?;

    // 查询用户
    let user: User = sqlx::query_as!(
        User,
        r#"
        SELECT id, handle, email, password_hash, display_name, role::text as "role!"
        FROM users
        WHERE id = $1
        "#,
        user_id
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "id": user.id,
        "handle": user.handle,
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
    })))
}
