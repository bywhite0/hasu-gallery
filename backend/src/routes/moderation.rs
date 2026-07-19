use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tower_sessions::Session;
use uuid::Uuid;

use crate::{storage, AppState};

const MAX_REVIEW_NOTE_LEN: usize = 1_000;

/// Query parameters for moderation queue
#[derive(Deserialize)]
pub struct QueueParams {
    pub gallery: String, // "meme" or "art"
    #[serde(default = "default_status")]
    pub status: String, // "pending", "approved", "rejected", "takedown"
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
    State(state): State<AppState>,
    Query(params): Query<QueueParams>,
) -> Result<Json<QueueResponse>, StatusCode> {
    validate_queue_params(&params)?;
    let pool = &state.db;

    let offset = (params.page - 1) * params.limit;

    // Get total count
    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM works
         WHERE gallery = $1::gallery_kind AND status = $2::work_status",
    )
    .bind(&params.gallery)
    .bind(&params.status)
    .fetch_one(pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Get works with uploader info
    let works = sqlx::query_as::<_, QueueWorkItem>(
        "SELECT
            w.id::UUID as id,
            w.title,
            w.gallery::TEXT as gallery,
            w.status::TEXT as status,
            u.handle as uploader_handle,
            w.thumbnail_asset_file as thumbnail_url,
            w.asset_file as file_url,
            w.origin::TEXT as origin,
            w.source,
            w.source_url,
            w.created_at,
            CONCAT(w.width, 'x', w.height) as dimensions,
            NULL::BIGINT as file_size_bytes
         FROM works w
         JOIN users u ON w.uploader_id = u.id
         WHERE w.gallery = $1::gallery_kind AND w.status = $2::work_status
         ORDER BY w.created_at ASC
         LIMIT $3 OFFSET $4",
    )
    .bind(&params.gallery)
    .bind(&params.status)
    .bind(params.limit as i64)
    .bind(offset as i64)
    .fetch_all(pool)
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
    pub status: String, // "approved", "rejected", "takedown"
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
    State(state): State<AppState>,
    Path(work_id): Path<Uuid>,
    Json(req): Json<UpdateStatusRequest>,
) -> Result<Json<UpdateStatusResponse>, StatusCode> {
    let UpdateStatusRequest { status, note } = req;
    validate_update_status(&status)?;
    let note = normalize_review_note(note)?;

    // Get moderator_id from session
    let moderator_id: i64 = session
        .get("user_id")
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;
    let work_id_str = work_id.to_string();

    // Start transaction
    let mut tx = state
        .db
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let current_status: Option<String> = sqlx::query_scalar(
        "SELECT status::TEXT FROM works WHERE id = $1 FOR UPDATE",
    )
    .bind(&work_id_str)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some(current_status) = current_status else {
        return Err(StatusCode::NOT_FOUND);
    };

    if !is_allowed_transition(&current_status, &status) {
        return Err(StatusCode::CONFLICT);
    }

    // Optimistic source guard: only transition from the locked current status.
    let updated = sqlx::query(
        "UPDATE works
         SET status = $1::work_status,
             reviewed_by = $3,
             reviewed_at = NOW(),
             review_note = $4,
             updated_at = NOW()
         WHERE id = $2 AND status = $5::work_status
         RETURNING updated_at, asset_file, thumbnail_asset_file",
    )
    .bind(&status)
    .bind(&work_id_str)
    .bind(moderator_id)
    .bind(&note)
    .bind(&current_status)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some(updated) = updated else {
        return Err(StatusCode::CONFLICT);
    };
    let updated_at: chrono::DateTime<chrono::Utc> = updated
        .try_get("updated_at")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let asset_file: Option<String> = updated.try_get::<String, _>("asset_file").ok();
    let thumbnail_asset_file: Option<String> =
        updated.try_get::<String, _>("thumbnail_asset_file").ok();

    // Record in moderation_log
    sqlx::query(
        "INSERT INTO moderation_log (work_id, actor_id, action, note)
         VALUES ($1, $2, $3, $4)",
    )
    .bind(&work_id_str)
    .bind(moderator_id)
    .bind(&status)
    .bind(&note)
    .execute(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Commit transaction
    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Takedown: best-effort delete public objects. CDN purge remains an ops step.
    if status == "takedown" {
        let mut keys = Vec::new();
        for url in [asset_file.as_deref(), thumbnail_asset_file.as_deref()]
            .into_iter()
            .flatten()
        {
            if let Some(key) = storage::object_key_from_public_url(url) {
                keys.push(key);
            }
        }
        // Fallback to UUID-derived keys when stored values are already bare keys.
        if keys.is_empty() {
            if let Some(asset) = asset_file.as_deref() {
                if !asset.contains("://") {
                    keys.push(asset.to_string());
                }
            }
            keys.push(format!("{}_thumb.jpg", work_id_str));
        }
        if !keys.is_empty() {
            storage::delete_files_best_effort(&state.s3_client, &storage::s3_bucket(), &keys).await;
            tracing::info!(
                work_id = %work_id_str,
                keys = ?keys,
                "takedown deleted source objects; purge CDN cache separately if configured"
            );
        }
    }

    Ok(Json(UpdateStatusResponse {
        id: work_id,
        status,
        updated_at,
    }))
}


fn validate_queue_params(params: &QueueParams) -> Result<(), StatusCode> {
    if params.gallery != "meme" && params.gallery != "art" {
        return Err(StatusCode::BAD_REQUEST);
    }

    if !["pending", "approved", "rejected", "takedown"].contains(&params.status.as_str()) {
        return Err(StatusCode::BAD_REQUEST);
    }

    if params.page < 1 || params.limit < 1 || params.limit > 100 {
        return Err(StatusCode::BAD_REQUEST);
    }

    Ok(())
}

fn validate_update_status(status: &str) -> Result<(), StatusCode> {
    if ["approved", "rejected", "takedown"].contains(&status) {
        Ok(())
    } else {
        Err(StatusCode::BAD_REQUEST)
    }
}

fn normalize_review_note(note: Option<String>) -> Result<Option<String>, StatusCode> {
    let Some(note) = note else {
        return Ok(None);
    };
    let note = note.trim().to_string();
    if note.is_empty() {
        return Ok(None);
    }
    if note.chars().count() > MAX_REVIEW_NOTE_LEN {
        return Err(StatusCode::BAD_REQUEST);
    }

    Ok(Some(note))
}

/// Moderation log entry
#[derive(Serialize, sqlx::FromRow)]
pub struct ModerationLogEntry {
    pub id: i64,
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

#[derive(Serialize, sqlx::FromRow)]
pub struct PendingBacklogItem {
    pub gallery: String,
    pub count: i64,
}

#[derive(Serialize)]
pub struct MonitoringSummary {
    pub total_uploads: i64,
    pub approved_uploads: i64,
    pub pending_backlog: i64,
    /// Fraction of uploads currently in approved status (not transport success).
    pub approval_rate: f64,
    /// Deprecated alias of `approval_rate` kept for existing dashboards.
    pub upload_success_rate: f64,
    pub pending_by_gallery: Vec<PendingBacklogItem>,
}

#[derive(sqlx::FromRow)]
struct MonitoringCounts {
    total_uploads: i64,
    approved_uploads: i64,
    pending_backlog: i64,
}

/// Get moderation log for a work
pub async fn get_log(
    State(state): State<AppState>,
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
         JOIN users u ON ml.actor_id = u.id
         WHERE ml.work_id = $1
         ORDER BY ml.created_at DESC",
    )
    .bind(work_id.to_string())
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ModerationLogResponse { work_id, logs }))
}

pub async fn get_monitoring_summary(
    State(state): State<AppState>,
) -> Result<Json<MonitoringSummary>, StatusCode> {
    let counts = sqlx::query_as::<_, MonitoringCounts>(
        r#"
        SELECT
          COUNT(*)::BIGINT AS total_uploads,
          COUNT(*) FILTER (WHERE status = 'approved'::work_status)::BIGINT AS approved_uploads,
          COUNT(*) FILTER (
            WHERE status = 'pending'::work_status
              AND (
                gallery <> 'fiction'::gallery_kind
                OR EXISTS (
                  SELECT 1
                  FROM fiction_revisions fr
                  WHERE fr.work_id = works.id
                    AND fr.state = 'pending'::fiction_revision_state
                )
              )
          )::BIGINT AS pending_backlog
        FROM works
        "#
    )
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let pending_by_gallery = sqlx::query_as::<_, PendingBacklogItem>(
        r#"
        SELECT gallery::TEXT AS gallery, COUNT(*)::BIGINT AS count
        FROM works
        WHERE status = 'pending'::work_status
          AND (
            gallery <> 'fiction'::gallery_kind
            OR EXISTS (
              SELECT 1
              FROM fiction_revisions fr
              WHERE fr.work_id = works.id
                AND fr.state = 'pending'::fiction_revision_state
            )
          )
        GROUP BY gallery
        ORDER BY gallery
        "#
    )
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let rate = approval_rate(counts.approved_uploads, counts.total_uploads);
    Ok(Json(MonitoringSummary {
        total_uploads: counts.total_uploads,
        approved_uploads: counts.approved_uploads,
        pending_backlog: counts.pending_backlog,
        approval_rate: rate,
        upload_success_rate: rate,
        pending_by_gallery,
    }))
}

fn approval_rate(approved_uploads: i64, total_uploads: i64) -> f64 {
    if total_uploads == 0 {
        0.0
    } else {
        approved_uploads as f64 / total_uploads as f64
    }
}

/// Spec transitions for moderator-driven status changes.
pub fn is_allowed_transition(from: &str, to: &str) -> bool {
    matches!(
        (from, to),
        ("pending", "approved") | ("pending", "rejected") | ("approved", "takedown")
    )
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_queue_params_accepts_expected_values() {
        let params = QueueParams {
            gallery: "art".to_string(),
            status: "pending".to_string(),
            page: 1,
            limit: 20,
        };

        assert!(validate_queue_params(&params).is_ok());
    }

    #[test]
    fn validate_queue_params_rejects_invalid_values() {
        let bad_gallery = QueueParams {
            gallery: "all".to_string(),
            status: "pending".to_string(),
            page: 1,
            limit: 20,
        };
        assert_eq!(
            validate_queue_params(&bad_gallery).unwrap_err(),
            StatusCode::BAD_REQUEST
        );

        let bad_limit = QueueParams {
            gallery: "art".to_string(),
            status: "pending".to_string(),
            page: 1,
            limit: 101,
        };
        assert_eq!(
            validate_queue_params(&bad_limit).unwrap_err(),
            StatusCode::BAD_REQUEST
        );
    }

    #[test]
    fn validate_update_status_rejects_pending() {
        assert!(validate_update_status("approved").is_ok());
        assert_eq!(
            validate_update_status("pending").unwrap_err(),
            StatusCode::BAD_REQUEST
        );
    }

    #[test]
    fn normalize_review_note_trims_and_limits_length() {
        assert_eq!(
            normalize_review_note(Some("  approved  ".to_string())).unwrap(),
            Some("approved".to_string())
        );
        assert_eq!(normalize_review_note(Some("   ".to_string())).unwrap(), None);
        assert_eq!(
            normalize_review_note(Some("x".repeat(MAX_REVIEW_NOTE_LEN + 1))).unwrap_err(),
            StatusCode::BAD_REQUEST
        );
    }

    #[test]
    fn approval_rate_handles_empty_and_non_empty_counts() {
        assert_eq!(approval_rate(0, 0), 0.0);
        assert_eq!(approval_rate(3, 4), 0.75);
    }

    #[test]
    fn allowed_transitions_match_moderation_matrix() {
        assert!(is_allowed_transition("pending", "approved"));
        assert!(is_allowed_transition("pending", "rejected"));
        assert!(is_allowed_transition("approved", "takedown"));
        assert!(!is_allowed_transition("pending", "takedown"));
        assert!(!is_allowed_transition("takedown", "approved"));
        assert!(!is_allowed_transition("approved", "rejected"));
        assert!(!is_allowed_transition("rejected", "approved"));
        assert!(!is_allowed_transition("rejected", "takedown"));
        assert!(!is_allowed_transition("approved", "approved"));
    }
}
