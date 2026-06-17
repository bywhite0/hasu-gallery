use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tower_sessions::Session;
use uuid::Uuid;

/// Query parameters for moderation queue
#[derive(Deserialize)]
pub struct QueueParams {
    pub gallery: String,          // "meme" or "art"
    #[serde(default = "default_status")]
    pub status: String,            // "pending", "approved", "rejected", "takedown"
    #[serde(default = "default_page")]
    pub page: i32,
    #[serde(default = "default_limit")]
    pub limit: i32,
}

fn default_status() -> String {
    "pending".to_string()
}

fn default_page() -> i32 {
    1
}

fn default_limit() -> i32 {
    20
}

/// Work item in moderation queue
#[derive(Serialize, sqlx::FromRow)]
pub struct QueueWorkItem {
    pub id: Uuid,
    pub title: String,
    pub gallery: String,
    pub status: String,
    pub uploader_handle: String,
    pub thumbnail_url: Option<String>,
    pub file_url: Option<String>,
    pub origin: Option<String>,
    pub source: Option<String>,
    pub source_url: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub dimensions: Option<String>,
    pub file_size_bytes: Option<i64>,
}

/// Pagination info
#[derive(Serialize)]
pub struct Pagination {
    pub total: i64,
    pub page: i32,
    pub limit: i32,
    pub total_pages: i32,
}

/// Moderation queue response
#[derive(Serialize)]
pub struct QueueResponse {
    pub works: Vec<QueueWorkItem>,
    pub pagination: Pagination,
}

/// Get moderation queue
pub async fn get_queue(
    State(pool): State<PgPool>,
    Query(params): Query<QueueParams>,
) -> Result<Json<QueueResponse>, StatusCode> {
    let offset = (params.page - 1) * params.limit;

    // Validate gallery
    if params.gallery != "meme" && params.gallery != "art" {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Validate status
    if !["pending", "approved", "rejected", "takedown"].contains(&params.status.as_str()) {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Get total count
    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM works
         WHERE gallery::TEXT = $1 AND status::TEXT = $2"
    )
    .bind(&params.gallery)
    .bind(&params.status)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Get works with uploader info
    let works = sqlx::query_as::<_, QueueWorkItem>(
        "SELECT
            w.id,
            w.title,
            w.gallery::TEXT as gallery,
            w.status::TEXT as status,
            u.handle as uploader_handle,
            w.thumbnail_url,
            w.file_url,
            w.origin::TEXT as origin,
            w.source,
            w.source_url,
            w.created_at,
            w.dimensions,
            w.file_size_bytes
         FROM works w
         JOIN users u ON w.uploader_id = u.id
         WHERE w.gallery::TEXT = $1 AND w.status::TEXT = $2
         ORDER BY w.created_at ASC
         LIMIT $3 OFFSET $4"
    )
    .bind(&params.gallery)
    .bind(&params.status)
    .bind(params.limit as i64)
    .bind(offset as i64)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let total_pages = ((total as f64) / (params.limit as f64)).ceil() as i32;

    Ok(Json(QueueResponse {
        works,
        pagination: Pagination {
            total,
            page: params.page,
            limit: params.limit,
            total_pages,
        },
    }))
}

/// Update work status request
#[derive(Deserialize)]
pub struct UpdateStatusRequest {
    pub status: String,  // "approved", "rejected", "takedown"
    pub note: Option<String>,
}

/// Update work status response
#[derive(Serialize)]
pub struct UpdateStatusResponse {
    pub id: Uuid,
    pub status: String,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Update work status
pub async fn update_status(
    session: Session,
    State(pool): State<PgPool>,
    Path(work_id): Path<Uuid>,
    Json(req): Json<UpdateStatusRequest>,
) -> Result<Json<UpdateStatusResponse>, StatusCode> {
    // Validate status
    if !["approved", "rejected", "takedown"].contains(&req.status.as_str()) {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Get moderator_id from session
    let moderator_id: i32 = session
        .get("user_id")
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Start transaction
    let mut tx = pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Update work status
    let updated_at: chrono::DateTime<chrono::Utc> = sqlx::query_scalar(
        "UPDATE works
         SET status = $1::work_status, updated_at = NOW()
         WHERE id = $2
         RETURNING updated_at"
    )
    .bind(&req.status)
    .bind(work_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    // Record in moderation_log
    sqlx::query(
        "INSERT INTO moderation_log (work_id, moderator_id, action, note)
         VALUES ($1, $2, $3::moderation_action, $4)"
    )
    .bind(work_id)
    .bind(moderator_id)
    .bind(&req.status)
    .bind(&req.note)
    .execute(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Commit transaction
    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(UpdateStatusResponse {
        id: work_id,
        status: req.status,
        updated_at,
    }))
}

/// Moderation log entry
#[derive(Serialize, sqlx::FromRow)]
pub struct ModerationLogEntry {
    pub id: i32,
    pub action: String,
    pub moderator_handle: String,
    pub note: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Moderation log response
#[derive(Serialize)]
pub struct ModerationLogResponse {
    pub work_id: Uuid,
    pub logs: Vec<ModerationLogEntry>,
}

/// Get moderation log for a work
pub async fn get_log(
    State(pool): State<PgPool>,
    Path(work_id): Path<Uuid>,
) -> Result<Json<ModerationLogResponse>, StatusCode> {
    let logs = sqlx::query_as::<_, ModerationLogEntry>(
        "SELECT
            ml.id,
            ml.action::TEXT as action,
            u.handle as moderator_handle,
            ml.note,
            ml.created_at
         FROM moderation_log ml
         JOIN users u ON ml.moderator_id = u.id
         WHERE ml.work_id = $1
         ORDER BY ml.created_at DESC"
    )
    .bind(work_id)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ModerationLogResponse {
        work_id,
        logs,
    }))
}
