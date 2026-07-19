use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tower_sessions::Session;

use super::auth::SESSION_USER_ID_KEY;
use super::works::{build_file_url, build_thumbnail_url, Pagination, WorkItem, WorksResponse};
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct MyWorksQuery {
    pub status: Option<String>,
    /// Optional content family filter: "image" (meme+art), "fiction", or a
    /// concrete gallery value ("meme" | "art" | "fiction").
    pub gallery: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct StatsResponse {
    pub total: i64,
    pub pending: i64,
    pub approved: i64,
    pub rejected: i64,
    pub takedown: i64,
    pub image_total: i64,
    pub image_pending: i64,
    pub image_approved: i64,
    pub image_rejected: i64,
    pub image_takedown: i64,
    pub fiction_total: i64,
    pub fiction_pending: i64,
    pub fiction_approved: i64,
    pub fiction_rejected: i64,
    pub fiction_takedown: i64,
}

/// Handler for GET /api/users/me/stats
pub async fn handle_my_stats(
    session: Session,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Extract user_id from session
    let user_id: i64 = session
        .get(SESSION_USER_ID_KEY)
        .await
        .map_err(|e| {
            tracing::error!("Session error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Session error".to_string(),
            )
        })?
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    // Image-focused summary keeps Fiction out of the image submission counters.
    let image_stats = sqlx::query!(
        r#"
        SELECT
            COUNT(*) as "total!",
            COUNT(*) FILTER (WHERE status = 'pending'::work_status) as "pending!",
            COUNT(*) FILTER (WHERE status = 'approved'::work_status) as "approved!",
            COUNT(*) FILTER (WHERE status = 'rejected'::work_status) as "rejected!",
            COUNT(*) FILTER (WHERE status = 'takedown'::work_status) as "takedown!"
        FROM works
        WHERE uploader_id = $1
          AND gallery IN ('meme'::gallery_kind, 'art'::gallery_kind)
        "#,
        user_id
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to fetch stats".to_string(),
        )
    })?;

    let fiction_stats = sqlx::query!(
        r#"
        SELECT
            COUNT(*) as "total!",
            COUNT(*) FILTER (WHERE status = 'pending'::work_status) as "pending!",
            COUNT(*) FILTER (WHERE status = 'approved'::work_status) as "approved!",
            COUNT(*) FILTER (WHERE status = 'rejected'::work_status) as "rejected!",
            COUNT(*) FILTER (WHERE status = 'takedown'::work_status) as "takedown!"
        FROM works
        WHERE uploader_id = $1
          AND gallery = 'fiction'::gallery_kind
        "#,
        user_id
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to fetch fiction stats".to_string(),
        )
    })?;

    Ok((
        StatusCode::OK,
        Json(StatsResponse {
            total: image_stats.total + fiction_stats.total,
            pending: image_stats.pending,
            approved: image_stats.approved,
            rejected: image_stats.rejected,
            takedown: image_stats.takedown,
            image_total: image_stats.total,
            image_pending: image_stats.pending,
            image_approved: image_stats.approved,
            image_rejected: image_stats.rejected,
            image_takedown: image_stats.takedown,
            fiction_total: fiction_stats.total,
            fiction_pending: fiction_stats.pending,
            fiction_approved: fiction_stats.approved,
            fiction_rejected: fiction_stats.rejected,
            fiction_takedown: fiction_stats.takedown,
        }),
    ))
}

/// Handler for GET /api/users/me/works
pub async fn handle_my_works(
    session: Session,
    State(state): State<AppState>,
    Query(params): Query<MyWorksQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Extract user_id from session
    let user_id: i64 = session
        .get(SESSION_USER_ID_KEY)
        .await
        .map_err(|e| {
            tracing::error!("Session error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Session error".to_string(),
            )
        })?
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    // Parse pagination parameters
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(24).clamp(1, 100);
    let offset = (page - 1) * limit;

    // Build WHERE clause with optional status / gallery family filter.
    let mut where_conditions = vec!["uploader_id = $1".to_string()];
    let mut param_index = 2;
    let mut bind_status: Option<String> = None;
    let mut bind_gallery: Option<String> = None;

    if let Some(ref status) = params.status {
        if !["pending", "approved", "rejected", "takedown"].contains(&status.as_str()) {
            return Err((
                StatusCode::BAD_REQUEST,
                "Invalid status parameter".to_string(),
            ));
        }
        where_conditions.push(format!("status = ${}::work_status", param_index));
        bind_status = Some(status.clone());
        param_index += 1;
    }

    if let Some(ref gallery) = params.gallery {
        match gallery.as_str() {
            "image" => {
                where_conditions.push(
                    "gallery IN ('meme'::gallery_kind, 'art'::gallery_kind)".to_string(),
                );
            }
            "fiction" | "meme" | "art" => {
                where_conditions.push(format!("gallery = ${}::gallery_kind", param_index));
                bind_gallery = Some(gallery.clone());
                param_index += 1;
            }
            _ => {
                return Err((
                    StatusCode::BAD_REQUEST,
                    "Invalid gallery parameter. Use image, fiction, meme, or art".to_string(),
                ));
            }
        }
    }

    let where_clause = where_conditions.join(" AND ");
    // Count total matching records
    let count_query = format!("SELECT COUNT(*) FROM works WHERE {}", where_clause);

    let mut count_query_builder = sqlx::query(&count_query).bind(user_id);

    if let Some(ref status) = bind_status {
        count_query_builder = count_query_builder.bind(status);
    }
    if let Some(ref gallery) = bind_gallery {
        count_query_builder = count_query_builder.bind(gallery);
    }

    let total: i64 = count_query_builder
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error in count query: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to count works".to_string(),
            )
        })?
        .try_get(0)
        .map_err(|e| {
            tracing::error!("Failed to extract count: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to parse count result".to_string(),
            )
        })?;

    // Calculate total pages
    let total_pages = ((total as f64) / (limit as f64)).ceil() as u32;

    // Fetch works
    let select_query = format!(
        "SELECT id, gallery::TEXT AS gallery, origin::TEXT AS origin, title, status::TEXT AS status, width, height, created_at, reviewed_at, review_note, asset_file
         FROM works
         WHERE {}
         ORDER BY created_at DESC
         LIMIT ${} OFFSET ${}",
        where_clause,
        param_index,
        param_index + 1
    );

    let mut query_builder = sqlx::query(&select_query).bind(user_id);

    if let Some(ref status) = bind_status {
        query_builder = query_builder.bind(status);
    }
    if let Some(ref gallery) = bind_gallery {
        query_builder = query_builder.bind(gallery);
    }

    query_builder = query_builder.bind(limit as i64).bind(offset as i64);

    let rows = query_builder.fetch_all(&state.db).await.map_err(|e| {
        tracing::error!("Database error in select query: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to fetch works".to_string(),
        )
    })?;

    // Map rows to WorkItem
    let works: Vec<WorkItem> = rows
        .iter()
        .map(|row| {
            let id: String = row.try_get("id").unwrap_or_default();
            let gallery: String = row.try_get("gallery").unwrap_or_default();
            let origin: Option<String> = row.try_get("origin").ok();
            let title: String = row.try_get("title").unwrap_or_default();
            let status: String = row.try_get("status").unwrap_or_default();
            let width: i32 = row.try_get("width").unwrap_or(0);
            let height: i32 = row.try_get("height").unwrap_or(0);
            let created_at: chrono::DateTime<chrono::Utc> =
                row.try_get("created_at").unwrap_or_default();
            let reviewed_at: Option<chrono::DateTime<chrono::Utc>> =
                row.try_get("reviewed_at").ok();
            let review_note: Option<String> = row.try_get("review_note").ok();
            let asset_file: String = row.try_get("asset_file").unwrap_or_default();

            WorkItem {
                id: id.clone(),
                gallery,
                origin,
                title,
                status,
                thumbnail_url: build_thumbnail_url(&id, &asset_file),
                file_url: build_file_url(&id, &asset_file),
                width,
                height,
                created_at: created_at.to_rfc3339(),
                reviewed_at: reviewed_at.map(|value| value.to_rfc3339()),
                review_note,
                uploader_name: None, // 我的作品列表不显示上传者（就是自己）
                uploader: None,
                source: None,
                source_url: None,
                rights_note: None,
                art_meta: None,
            }
        })
        .collect();

    // Build response
    let response = WorksResponse {
        works,
        pagination: Pagination {
            page,
            limit,
            total,
            total_pages,
        },
    };

    Ok((StatusCode::OK, Json(response)))
}
