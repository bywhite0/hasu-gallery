use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use validator::Validate;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: i64,
    pub handle: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub display_name: String,
    pub role: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(length(min = 3, max = 32))]
    pub handle: String,

    #[validate(email)]
    pub email: String,

    #[validate(length(min = 8))]
    pub password: String,

    #[validate(length(min = 1, max = 64))]
    pub display_name: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(length(min = 1))]
    pub handle: String,

    #[validate(length(min = 1))]
    pub password: String,
}

/// 通过 handle 查找用户
pub async fn find_user_by_handle(pool: &PgPool, handle: &str) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as!(
        User,
        r#"
        SELECT id, handle, email, password_hash, display_name, role::text as "role!"
        FROM users
        WHERE handle = $1
        "#,
        handle
    )
    .fetch_optional(pool)
    .await
}

/// 通过 email 查找用户
pub async fn find_user_by_email(pool: &PgPool, email: &str) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as!(
        User,
        r#"
        SELECT id, handle, email, password_hash, display_name, role::text as "role!"
        FROM users
        WHERE email = $1
        "#,
        email
    )
    .fetch_optional(pool)
    .await
}

/// 创建新用户
pub async fn create_user(
    pool: &PgPool,
    handle: &str,
    email: &str,
    password_hash: &str,
    display_name: &str,
) -> Result<User, sqlx::Error> {
    sqlx::query_as!(
        User,
        r#"
        INSERT INTO users (handle, email, password_hash, display_name, role)
        VALUES ($1, $2, $3, $4, 'member')
        RETURNING id, handle, email, password_hash, display_name, role::text as "role!"
        "#,
        handle,
        email,
        password_hash,
        display_name
    )
    .fetch_one(pool)
    .await
}
