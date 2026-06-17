use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tower_sessions::Session;

use crate::AppState;
use super::auth::SESSION_USER_ID_KEY;
use super::works::{Pagination, WorkItem, WorksResponse, build_thumbnail_url, build_file_url};

#[derive(Debug, Deserialize)]
pub struct MyWorksQuery {
    pub status: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct StatsResponse {
    pub total: i64,
    pub pending: i64,
    pub approved: i64,
    pub rejected: i64,
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
            (StatusCode::INTERNAL_SERVER_ERROR, "Session error".to_string())
        })?
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    // 使用单次聚合查询优化 N+1 问题
    let stats = sqlx::query!(
        r#"
        SELECT
            COUNT(*) as "total!",
            COUNT(*) FILTER (WHERE status = 'pending'::work_status) as "pending!",
            COUNT(*) FILTER (WHERE status = 'approved'::work_status) as "approved!",
            COUNT(*) FILTER (WHERE status = 'rejected'::work_status) as "rejected!"
        FROM works
        WHERE uploader_id = $1
        "#,
        user_id
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch stats".to_string())
    })?;

    Ok((StatusCode::OK, Json(StatsResponse {
        total: stats.total,
        pending: stats.pending,
        approved: stats.approved,
        rejected: stats.rejected,
    })))
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
            (StatusCode::INTERNAL_SERVER_ERROR, "Session error".to_string())
        })?
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    // Parse pagination parameters
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(24).clamp(1, 100);
    let offset = (page - 1) * limit;

    // Build WHERE clause with optional status filter
    let mut where_conditions = vec!["uploader_id = $1".to_string()];
    let mut param_index = 2;

    if let Some(ref status) = params.status {
        if !["pending", "approved", "rejected", "takedown"].contains(&status.as_str()) {
            return Err((
                StatusCode::BAD_REQUEST,
                "Invalid status parameter".to_string(),
            ));
        }
        where_conditions.push(format!("status = ${}::work_status", param_index));
        param_index += 1;
    }

    let where_clause = where_conditions.join(" AND ");

    // Count total matching records
    let count_query = format!("SELECT COUNT(*) FROM works WHERE {}", where_clause);

    let mut count_query_builder = sqlx::query(&count_query).bind(user_id);

    if let Some(ref status) = params.status {
        count_query_builder = count_query_builder.bind(status);
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
        "SELECT id, gallery, origin, title, status, width, height, created_at, asset_file
         FROM works
         WHERE {}
         ORDER BY created_at DESC
         LIMIT ${} OFFSET ${}",
        where_clause,
        param_index,
        param_index + 1
    );

    let mut query_builder = sqlx::query(&select_query).bind(user_id);

    if let Some(ref status) = params.status {
        query_builder = query_builder.bind(status);
    }

    query_builder = query_builder
        .bind(limit as i64)
        .bind(offset as i64);

    let rows = query_builder
        .fetch_all(&state.db)
        .await
        .map_err(|e| {
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
            let created_at: chrono::DateTime<chrono::Utc> = row.try_get("created_at").unwrap_or_default();
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
                uploader_name: None, // 我的作品列表不显示上传者（就是自己）
                source: None,
                source_url: None,
                rights_note: None,
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
