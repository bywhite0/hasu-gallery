use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;

use crate::AppState;

/// Query parameters for works listing
#[derive(Debug, Deserialize)]
pub struct WorksQuery {
    pub gallery: String,
    pub status: Option<String>,
    pub origin: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub sort: Option<String>,
}

/// Work item in response
#[derive(Debug, Serialize)]
pub struct WorkItem {
    pub id: String,
    pub gallery: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub origin: Option<String>,
    pub title: String,
    pub status: String,
    pub thumbnail_url: String,
    pub file_url: String,
    pub width: i32,
    pub height: i32,
    pub created_at: String,
}

/// Pagination metadata
#[derive(Debug, Serialize)]
pub struct Pagination {
    pub page: u32,
    pub limit: u32,
    pub total: i64,
    pub total_pages: u32,
}

/// Works list response
#[derive(Debug, Serialize)]
pub struct WorksResponse {
    pub works: Vec<WorkItem>,
    pub pagination: Pagination,
}

/// Get public media base URL from environment or use default
fn get_media_base_url() -> String {
    std::env::var("PUBLIC_MEDIA_BASE_URL")
        .unwrap_or_else(|_| "https://assets.kaho.top/hasu-gallery".to_string())
}

/// Extract file extension from asset_file path
fn extract_extension(asset_file: &str) -> &str {
    asset_file
        .rsplit('.')
        .next()
        .unwrap_or("jpg")
}

/// Build thumbnail URL for a work
fn build_thumbnail_url(id: &str, asset_file: &str) -> String {
    let base = get_media_base_url();
    let ext = extract_extension(asset_file);
    format!("{}/{}_thumb.{}", base, id, ext)
}

/// Build file URL for a work
fn build_file_url(id: &str, asset_file: &str) -> String {
    let base = get_media_base_url();
    let ext = extract_extension(asset_file);
    format!("{}/{}.{}", base, id, ext)
}

/// Handler for GET /api/works
pub async fn handle_works_list(
    State(state): State<AppState>,
    Query(params): Query<WorksQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Validate gallery parameter
    if params.gallery != "meme" && params.gallery != "art" {
        return Err((
            StatusCode::BAD_REQUEST,
            "Invalid gallery parameter. Must be 'meme' or 'art'".to_string(),
        ));
    }

    // Parse and validate status
    let status = params.status.as_deref().unwrap_or("approved");
    if !["pending", "approved", "rejected", "takedown"].contains(&status) {
        return Err((
            StatusCode::BAD_REQUEST,
            "Invalid status parameter".to_string(),
        ));
    }

    // Parse pagination parameters
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(24).clamp(1, 100);
    let offset = (page - 1) * limit;

    // Parse sort parameter
    let sort = params.sort.as_deref().unwrap_or("created_at_desc");
    let order_by = match sort {
        "created_at_desc" => "created_at DESC",
        "created_at_asc" => "created_at ASC",
        "title_asc" => "title ASC",
        _ => {
            return Err((
                StatusCode::BAD_REQUEST,
                "Invalid sort parameter. Must be one of: created_at_desc, created_at_asc, title_asc".to_string(),
            ));
        }
    };

    // Build WHERE clause with proper type casts for enums
    let mut where_conditions = vec![
        "gallery = $1::gallery_kind".to_string(),
        "status = $2::work_status".to_string(),
    ];
    let mut param_index = 3;

    if params.gallery == "meme" && params.origin.is_some() {
        let origin = params.origin.as_ref().unwrap();
        if !["official", "derived", "fan_made"].contains(&origin.as_str()) {
            return Err((
                StatusCode::BAD_REQUEST,
                "Invalid origin parameter. Must be one of: official, derived, fan_made".to_string(),
            ));
        }
        where_conditions.push(format!("origin = ${}::meme_origin", param_index));
        param_index += 1;
    }

    let where_clause = where_conditions.join(" AND ");

    // Count total matching records
    let count_query = format!(
        "SELECT COUNT(*) FROM works WHERE {}",
        where_clause
    );

    let mut count_query_builder = sqlx::query(&count_query)
        .bind(&params.gallery)
        .bind(status);

    if params.gallery == "meme" && params.origin.is_some() {
        count_query_builder = count_query_builder.bind(params.origin.as_ref().unwrap());
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
         ORDER BY {}
         LIMIT ${} OFFSET ${}",
        where_clause,
        order_by,
        param_index,
        param_index + 1
    );

    let mut query_builder = sqlx::query(&select_query)
        .bind(&params.gallery)
        .bind(status);

    if params.gallery == "meme" && params.origin.is_some() {
        query_builder = query_builder.bind(params.origin.as_ref().unwrap());
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
