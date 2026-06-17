use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
};
use sqlx::PgPool;
use tower_sessions::Session;

/// Middleware to require moderator or admin role
pub async fn require_moderator(
    session: Session,
    State(pool): State<PgPool>,
    request: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    // Get user_id from session
    let user_id: i32 = session
        .get("user_id")
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Query user role from database
    let role: String = sqlx::query_scalar(
        "SELECT role::TEXT FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Check if user is moderator or admin
    if role != "moderator" && role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }

    // User is authorized, proceed
    Ok(next.run(request).await)
}
