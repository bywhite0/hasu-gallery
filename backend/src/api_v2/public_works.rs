use axum::{
    Router,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::get,
};
use serde::Deserialize;
use sqlx::Row;

use crate::AppState;
use crate::proto::hasu::gallery::v2::{
    ContentRating, FacetItem, GalleryKind, MemeOrigin, Pagination, PublicArtFacetsResponse,
    PublicArtMeta, PublicUserSummary, PublicWork, PublicWorksResponse, WorkStatus,
};
use crate::routes::works::{build_file_url, build_thumbnail_url, work_order_by};

use super::codec::{
    PROTO_MEDIA_TYPE, accepts_protobuf, error_response, not_acceptable, protobuf_response,
};

const MAX_PAGE_SIZE: u32 = 50;

#[derive(Debug, Deserialize)]
pub struct PublicWorksQuery {
    pub gallery: String,
    pub origin: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub sort: Option<String>,
    pub artist: Option<String>,
    pub medium: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PublicFacetsQuery {
    pub gallery: String,
}

pub fn public_works_routes() -> Router<AppState> {
    Router::new()
        .route("/api/v2/public/works", get(list_public_works))
        .route("/api/v2/public/works/facets", get(public_work_facets))
        .route("/api/v2/public/works/:id", get(public_work_detail))
}

async fn list_public_works(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<PublicWorksQuery>,
) -> impl IntoResponse {
    if let Some(reject) = require_protobuf_accept(&headers) {
        return reject;
    }

    if params.gallery != "meme" && params.gallery != "art" {
        return public_error(
            StatusCode::BAD_REQUEST,
            "invalid_gallery",
            "error.invalid_gallery",
            "Invalid gallery parameter. Must be 'meme' or 'art'",
        );
    }

    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(24).clamp(1, MAX_PAGE_SIZE);
    let offset = (page - 1) * limit;

    let order_by = match work_order_by(params.sort.as_deref()) {
        Ok(value) => value,
        Err((status, message)) => {
            return public_error(
                status,
                "invalid_sort",
                "error.invalid_sort",
                &message,
            );
        }
    };

    // Public V2 reads never inspect cookies: only approved works, Art locked to all_ages.
    let mut where_conditions = vec![
        "w.gallery = $1::gallery_kind".to_string(),
        "w.status = 'approved'::work_status".to_string(),
    ];
    let mut join_clause = String::new();
    let mut param_index = 2u32;

    if params.gallery == "meme" {
        if let Some(ref origin) = params.origin {
            if !["official", "derived", "fan_made"].contains(&origin.as_str()) {
                return public_error(
                    StatusCode::BAD_REQUEST,
                    "invalid_origin",
                    "error.invalid_origin",
                    "Invalid origin parameter. Must be one of: official, derived, fan_made",
                );
            }
            where_conditions.push(format!("w.origin = ${}::meme_origin", param_index));
            param_index += 1;
        }
    }

    if params.gallery == "art" {
        join_clause = " LEFT JOIN work_art_meta am ON w.id = am.work_id".to_string();
        where_conditions.push(format!("am.rating = ${}::art_rating", param_index));
        param_index += 1;

        if let Some(ref artist_val) = params.artist {
            if !artist_val.trim().is_empty() {
                where_conditions.push(format!("am.artist ILIKE ${}", param_index));
                param_index += 1;
            }
        }
        if let Some(ref medium_val) = params.medium {
            if !medium_val.trim().is_empty() {
                where_conditions.push(format!("am.medium ILIKE ${}", param_index));
                param_index += 1;
            }
        }
    }

    let where_clause = where_conditions.join(" AND ");
    let count_query = format!(
        "SELECT COUNT(*) FROM works w{} WHERE {}",
        join_clause, where_clause
    );

    let mut count_builder = sqlx::query(&count_query).bind(&params.gallery);
    if params.gallery == "meme" {
        if let Some(ref origin) = params.origin {
            count_builder = count_builder.bind(origin);
        }
    }
    if params.gallery == "art" {
        count_builder = count_builder.bind("all_ages");
        if let Some(ref artist_val) = params.artist {
            if !artist_val.trim().is_empty() {
                count_builder = count_builder.bind(format!("%{}%", artist_val));
            }
        }
        if let Some(ref medium_val) = params.medium {
            if !medium_val.trim().is_empty() {
                count_builder = count_builder.bind(format!("%{}%", medium_val));
            }
        }
    }

    let total: i64 = match count_builder.fetch_one(&state.db).await {
        Ok(row) => match row.try_get(0) {
            Ok(value) => value,
            Err(err) => {
                tracing::error!("v2 public works count parse failed: {}", err);
                return public_error(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal_error",
                    "error.internal",
                    "Failed to count works",
                );
            }
        },
        Err(err) => {
            tracing::error!("v2 public works count failed: {}", err);
            return public_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal_error",
                "error.internal",
                "Failed to count works",
            );
        }
    };

    let total_pages = if total == 0 {
        0
    } else {
        ((total as f64) / (limit as f64)).ceil() as u32
    };

    let select_query = format!(
        "SELECT w.id, w.gallery::TEXT AS gallery, w.origin::TEXT AS origin, w.title,
                w.status::TEXT AS status, w.width, w.height, w.created_at, w.asset_file
         FROM works w{}
         WHERE {}
         ORDER BY {}
         LIMIT ${} OFFSET ${}",
        join_clause,
        where_clause,
        order_by,
        param_index,
        param_index + 1
    );

    let mut select_builder = sqlx::query(&select_query).bind(&params.gallery);
    if params.gallery == "meme" {
        if let Some(ref origin) = params.origin {
            select_builder = select_builder.bind(origin);
        }
    }
    if params.gallery == "art" {
        select_builder = select_builder.bind("all_ages");
        if let Some(ref artist_val) = params.artist {
            if !artist_val.trim().is_empty() {
                select_builder = select_builder.bind(format!("%{}%", artist_val));
            }
        }
        if let Some(ref medium_val) = params.medium {
            if !medium_val.trim().is_empty() {
                select_builder = select_builder.bind(format!("%{}%", medium_val));
            }
        }
    }
    select_builder = select_builder.bind(limit as i64).bind(offset as i64);

    let rows = match select_builder.fetch_all(&state.db).await {
        Ok(rows) => rows,
        Err(err) => {
            tracing::error!("v2 public works select failed: {}", err);
            return public_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal_error",
                "error.internal",
                "Failed to fetch works",
            );
        }
    };

    let works = rows
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
            let asset_file: String = row.try_get("asset_file").unwrap_or_default();

            PublicWork {
                id: id.clone(),
                gallery: map_gallery(&gallery),
                origin: map_origin(origin.as_deref()),
                title,
                status: map_status(&status),
                thumbnail_url: build_thumbnail_url(&id, &asset_file),
                file_url: build_file_url(&id, &asset_file),
                width,
                height,
                created_at: created_at.to_rfc3339(),
                uploader_name: String::new(),
                uploader: None,
                source: String::new(),
                source_url: String::new(),
                rights_note: String::new(),
                art_meta: None,
            }
        })
        .collect();

    let response = PublicWorksResponse {
        works,
        pagination: Some(Pagination {
            page,
            limit,
            total,
            total_pages,
        }),
    };

    let mut http = protobuf_response(StatusCode::OK, &response);
    http.headers_mut().insert(
        axum::http::header::CACHE_CONTROL,
        axum::http::HeaderValue::from_static("public, max-age=60, stale-while-revalidate=120"),
    );
    http
}

async fn public_work_detail(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Some(reject) = require_protobuf_accept(&headers) {
        return reject;
    }

    let query = "SELECT w.id, w.gallery::TEXT AS gallery, w.origin::TEXT AS origin, w.title,
                        w.status::TEXT AS status, w.width, w.height,
                        w.source, w.source_url, w.rights_note, w.created_at, w.asset_file,
                        u.display_name as uploader_name,
                        u.handle as uploader_handle,
                        u.display_name as uploader_display_name,
                        u.created_at as uploader_joined_at,
                        COALESCE(up.approved_public_work_count, 0)::BIGINT as uploader_approved_public_work_count,
                        am.artist, am.medium, am.rating::TEXT AS rating
                 FROM works w
                 LEFT JOIN users u ON w.uploader_id = u.id
                 LEFT JOIN LATERAL (
                    SELECT COUNT(*)::BIGINT as approved_public_work_count
                    FROM works public_work
                    WHERE public_work.uploader_id = u.id
                      AND public_work.status = 'approved'::work_status
                 ) up ON TRUE
                 LEFT JOIN work_art_meta am ON w.id = am.work_id
                 WHERE w.id = $1
                   AND w.status = 'approved'::work_status
                   AND (w.gallery = 'meme'::gallery_kind
                        OR (w.gallery = 'art'::gallery_kind AND am.rating = 'all_ages'::art_rating))";

    let row = match sqlx::query(query).bind(&id).fetch_optional(&state.db).await {
        Ok(row) => row,
        Err(err) => {
            tracing::error!("v2 public work detail failed for {}: {}", id, err);
            return public_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal_error",
                "error.internal",
                "Failed to fetch work",
            );
        }
    };

    let Some(row) = row else {
        return public_error(
            StatusCode::NOT_FOUND,
            "not_found",
            "error.not_found",
            &format!("Work with id {} not found", id),
        );
    };

    let work_id: String = row.try_get("id").unwrap_or_default();
    let gallery: String = row.try_get("gallery").unwrap_or_default();
    let origin: Option<String> = row.try_get("origin").ok();
    let title: String = row.try_get("title").unwrap_or_default();
    let status: String = row.try_get("status").unwrap_or_default();
    let width: i32 = row.try_get("width").unwrap_or(0);
    let height: i32 = row.try_get("height").unwrap_or(0);
    let source: Option<String> = row.try_get("source").ok();
    let source_url: Option<String> = row.try_get("source_url").ok();
    let rights_note: Option<String> = row.try_get("rights_note").ok();
    let created_at: chrono::DateTime<chrono::Utc> = row.try_get("created_at").unwrap_or_default();
    let asset_file: String = row.try_get("asset_file").unwrap_or_default();
    let uploader_name: Option<String> = row.try_get("uploader_name").ok();
    let uploader_handle: Option<String> = row.try_get("uploader_handle").ok();
    let uploader_display_name: Option<String> = row.try_get("uploader_display_name").ok();
    let uploader_joined_at: Option<chrono::DateTime<chrono::Utc>> =
        row.try_get("uploader_joined_at").ok();
    let uploader_approved_public_work_count: i64 = row
        .try_get("uploader_approved_public_work_count")
        .unwrap_or(0);
    let art_artist: Option<String> = row.try_get("artist").ok();
    let art_medium: Option<String> = row.try_get("medium").ok();
    let art_rating: Option<String> = row.try_get("rating").ok();

    let work = PublicWork {
        id: work_id.clone(),
        gallery: map_gallery(&gallery),
        origin: map_origin(origin.as_deref()),
        title,
        status: map_status(&status),
        thumbnail_url: build_thumbnail_url(&work_id, &asset_file),
        file_url: build_file_url(&work_id, &asset_file),
        width,
        height,
        created_at: created_at.to_rfc3339(),
        uploader_name: uploader_name.unwrap_or_default(),
        uploader: uploader_handle.map(|handle| PublicUserSummary {
            handle,
            display_name: uploader_display_name.unwrap_or_default(),
            joined_at: uploader_joined_at
                .map(|value| value.to_rfc3339())
                .unwrap_or_default(),
            approved_public_work_count: uploader_approved_public_work_count,
        }),
        source: source.unwrap_or_default(),
        source_url: source_url.unwrap_or_default(),
        rights_note: rights_note.unwrap_or_default(),
        art_meta: art_artist.map(|artist| PublicArtMeta {
            artist,
            medium: art_medium.unwrap_or_default(),
            content_rating: map_content_rating(art_rating.as_deref()),
        }),
    };

    let mut http = protobuf_response(StatusCode::OK, &work);
    http.headers_mut().insert(
        axum::http::header::CACHE_CONTROL,
        axum::http::HeaderValue::from_static("public, max-age=60, stale-while-revalidate=120"),
    );
    http
}

async fn public_work_facets(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<PublicFacetsQuery>,
) -> impl IntoResponse {
    if let Some(reject) = require_protobuf_accept(&headers) {
        return reject;
    }

    if params.gallery != "art" {
        return public_error(
            StatusCode::BAD_REQUEST,
            "invalid_gallery",
            "error.invalid_gallery",
            "Facets are currently available for art gallery only",
        );
    }

    // Public facets never inspect cookies and only aggregate all_ages approved works.
    let artists = match fetch_art_facet(
        &state.db,
        "SELECT am.artist AS value, am.artist AS label, COUNT(*)::BIGINT AS count
         FROM works w
         JOIN work_art_meta am ON w.id = am.work_id
         WHERE w.gallery = 'art'::gallery_kind
           AND w.status = 'approved'::work_status
           AND btrim(am.artist) <> ''
           AND am.rating = 'all_ages'::art_rating
         GROUP BY am.artist
         ORDER BY COUNT(*) DESC, am.artist ASC
         LIMIT 50",
        "artists",
    )
    .await
    {
        Ok(value) => value,
        Err(response) => return response,
    };

    let media = match fetch_art_facet(
        &state.db,
        "SELECT am.medium AS value, am.medium AS label, COUNT(*)::BIGINT AS count
         FROM works w
         JOIN work_art_meta am ON w.id = am.work_id
         WHERE w.gallery = 'art'::gallery_kind
           AND w.status = 'approved'::work_status
           AND am.medium IS NOT NULL
           AND btrim(am.medium) <> ''
           AND am.rating = 'all_ages'::art_rating
         GROUP BY am.medium
         ORDER BY COUNT(*) DESC, am.medium ASC
         LIMIT 50",
        "media",
    )
    .await
    {
        Ok(value) => value,
        Err(response) => return response,
    };

    let ratings = match fetch_art_facet(
        &state.db,
        "SELECT am.rating::TEXT AS value,
                CASE am.rating::TEXT
                  WHEN 'all_ages' THEN 'All Ages'
                  WHEN 'r15' THEN 'R-15'
                  WHEN 'r18' THEN 'R-18'
                  ELSE am.rating::TEXT
                END AS label,
                COUNT(*)::BIGINT AS count
         FROM works w
         JOIN work_art_meta am ON w.id = am.work_id
         WHERE w.gallery = 'art'::gallery_kind
           AND w.status = 'approved'::work_status
           AND am.rating = 'all_ages'::art_rating
         GROUP BY am.rating
         ORDER BY 1",
        "ratings",
    )
    .await
    {
        Ok(value) => value,
        Err(response) => return response,
    };

    let response = PublicArtFacetsResponse {
        artists,
        media,
        ratings,
    };
    let mut http = protobuf_response(StatusCode::OK, &response);
    http.headers_mut().insert(
        axum::http::header::CACHE_CONTROL,
        axum::http::HeaderValue::from_static("public, max-age=60, stale-while-revalidate=120"),
    );
    // Silence unused constant warning in this module while documenting media type.
    let _ = PROTO_MEDIA_TYPE;
    http
}

async fn fetch_art_facet(
    db: &crate::db::DbPool,
    query: &str,
    facet_name: &str,
) -> Result<Vec<FacetItem>, axum::response::Response> {
    let rows = sqlx::query(query).fetch_all(db).await.map_err(|err| {
        tracing::error!("v2 public {} facet failed: {}", facet_name, err);
        public_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "internal_error",
            "error.internal",
            &format!("Failed to fetch {} facet", facet_name),
        )
    })?;

    Ok(rows
        .iter()
        .map(|row| FacetItem {
            value: row.try_get("value").unwrap_or_default(),
            label: row.try_get("label").unwrap_or_default(),
            count: row.try_get("count").unwrap_or_default(),
        })
        .collect())
}

fn require_protobuf_accept(headers: &HeaderMap) -> Option<axum::response::Response> {
    if accepts_protobuf(headers) {
        None
    } else {
        Some(not_acceptable("public-works"))
    }
}

fn public_error(
    status: StatusCode,
    code: &str,
    message_key: &str,
    message: &str,
) -> axum::response::Response {
    error_response(status, code, message_key, message, "public", Vec::new())
}

fn map_gallery(value: &str) -> i32 {
    match value {
        "meme" => GalleryKind::Meme as i32,
        "art" => GalleryKind::Art as i32,
        _ => GalleryKind::Unspecified as i32,
    }
}

fn map_status(value: &str) -> i32 {
    match value {
        "pending" => WorkStatus::Pending as i32,
        "approved" => WorkStatus::Approved as i32,
        "rejected" => WorkStatus::Rejected as i32,
        "takedown" => WorkStatus::Takedown as i32,
        _ => WorkStatus::Unspecified as i32,
    }
}

fn map_origin(value: Option<&str>) -> i32 {
    match value {
        Some("official") => MemeOrigin::Official as i32,
        Some("derived") => MemeOrigin::Derived as i32,
        Some("fan_made") => MemeOrigin::FanMade as i32,
        _ => MemeOrigin::Unspecified as i32,
    }
}

fn map_content_rating(value: Option<&str>) -> i32 {
    match value {
        Some("all_ages") => ContentRating::AllAges as i32,
        Some("r15") => ContentRating::R15 as i32,
        Some("r18") => ContentRating::R18 as i32,
        _ => ContentRating::Unspecified as i32,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::{to_bytes, Body};
    use axum::http::Request;
    use aws_config::BehaviorVersion;
    use aws_sdk_s3::config::{Credentials, Region};
    use prost::Message;
    use sqlx::postgres::PgPoolOptions;
    use tower::ServiceExt;

    use crate::api_v2::codec::PROTO_MEDIA_TYPE;
    use crate::proto::hasu::gallery::v2::ErrorResponse;

    fn test_state() -> AppState {
        let db = PgPoolOptions::new()
            .connect_lazy("postgres://hasu_user:hasu_pass@localhost:5432/hasu_gallery_test")
            .expect("test database URL should parse");
        let s3_config = aws_sdk_s3::Config::builder()
            .behavior_version(BehaviorVersion::latest())
            .region(Region::new("us-east-1"))
            .credentials_provider(Credentials::new(
                "test-access-key",
                "test-secret-key",
                None,
                None,
                "hasu-gallery-test",
            ))
            .endpoint_url("http://localhost:9000")
            .build();
        AppState {
            db,
            s3_client: aws_sdk_s3::Client::from_conf(s3_config),
        }
    }

    #[tokio::test]
    async fn public_works_rejects_invalid_gallery_with_protobuf_error() {
        let app = public_works_routes().with_state(test_state());
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/v2/public/works?gallery=fiction")
                    .header(axum::http::header::ACCEPT, PROTO_MEDIA_TYPE)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        assert_eq!(
            response
                .headers()
                .get(axum::http::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok()),
            Some(PROTO_MEDIA_TYPE)
        );
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let err = ErrorResponse::decode(body.as_ref()).unwrap();
        assert_eq!(err.code, "invalid_gallery");
    }

    #[tokio::test]
    async fn public_facets_rejects_non_art_gallery() {
        let app = public_works_routes().with_state(test_state());
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/v2/public/works/facets?gallery=meme")
                    .header(axum::http::header::ACCEPT, PROTO_MEDIA_TYPE)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }
}
