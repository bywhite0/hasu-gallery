use axum::{
    Router,
    body::Bytes,
    extract::{DefaultBodyLimit, Path, Query, State},
    http::{HeaderMap, StatusCode, header},
    response::IntoResponse,
    routing::{get, post, put},
};
use prost::Message;
use serde::Deserialize;
use sqlx::Row;
use tower_sessions::Session;
use uuid::Uuid;

use crate::AppState;
use crate::fiction::{
    CreateFictionInput, create_fiction_draft, decide_revision, excerpt_from_plain,
    save_draft_revision, submit_revision,
};
use crate::proto::hasu::gallery::v2::{
    ContentKind, ContentRating, CreateFictionRequest, CreateFictionResponse,
    FictionDecision, FictionDecisionRequest, FictionDecisionResponse, FictionRevision,
    ModerationFictionQueueResponse, OwnerFictionDraft, OwnerFictionListResponse,
    PublicFictionDetail, PublicFictionListResponse, PublicFictionSummary, SaveFictionDraftRequest,
    SaveFictionDraftResponse, SubmitFictionRequest, SubmitFictionResponse,
};
use crate::routes::auth::SESSION_USER_ID_KEY;

use super::codec::{
    PROTO_MEDIA_TYPE, accepts_protobuf, content_type_is_protobuf, error_response, not_acceptable,
    protobuf_response, unsupported_media_type,
};

const MAX_PAGE: u32 = 50;
// Architecture V2 §7.4: Fiction revision bodies need 2 MiB markup headroom + envelope.
const FICTION_REVISION_BODY_LIMIT: usize = 2 * 1024 * 1024 + 64 * 1024;
// Architecture V2 §7.4: non-revision command default body limit.
const SMALL_COMMAND_BODY_LIMIT: usize = 64 * 1024;

#[derive(Debug, Deserialize)]
pub struct PublicFictionListQuery {
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub q: Option<String>,
    pub fandom: Option<String>,
}

pub fn fiction_routes() -> Router<AppState> {
    Router::new()
        .route("/api/v2/public/fictions", get(list_public_fictions))
        .route("/api/v2/public/fictions/:work_id", get(get_public_fiction))
        .route(
            "/api/v2/account/fictions",
            get(list_owner_fictions)
                .post(create_fiction)
                .layer(DefaultBodyLimit::max(FICTION_REVISION_BODY_LIMIT)),
        )
        .route(
            "/api/v2/account/fictions/:work_id/draft",
            put(save_fiction_draft).layer(DefaultBodyLimit::max(FICTION_REVISION_BODY_LIMIT)),
        )
        .route(
            "/api/v2/account/fictions/:work_id/submit",
            post(submit_fiction).layer(DefaultBodyLimit::max(SMALL_COMMAND_BODY_LIMIT)),
        )
        .route("/api/v2/moderation/fictions", get(moderation_queue))
        .route(
            "/api/v2/moderation/fictions/:work_id/revisions/:revision_id/decision",
            post(moderation_decision).layer(DefaultBodyLimit::max(SMALL_COMMAND_BODY_LIMIT)),
        )
}

async fn list_public_fictions(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<PublicFictionListQuery>,
) -> impl IntoResponse {
    if let Some(r) = require_accept(&headers) {
        return r;
    }

    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(24).clamp(1, MAX_PAGE);
    let offset = (page - 1) * limit;
    let q = params.q.as_deref().map(str::trim).filter(|s| !s.is_empty());
    let fandom = params
        .fandom
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());

    // Public: approved works with published revision pointer; all_ages only (no cookies).
    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)
         FROM works w
         JOIN work_fiction_meta m ON m.work_id = w.id
         WHERE w.gallery = 'fiction'::gallery_kind
           AND w.status = 'approved'::work_status
           AND m.current_published_revision_id IS NOT NULL
           AND m.content_rating = 'all_ages'::content_rating
           AND ($1::text IS NULL OR m.fandom ILIKE '%' || $1 || '%')
           AND ($2::text IS NULL OR w.title ILIKE '%' || $2 || '%' OR m.synopsis ILIKE '%' || $2 || '%')",
    )
    .bind(fandom)
    .bind(q)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let rows = sqlx::query(
        "SELECT w.id, w.title, m.synopsis, m.content_rating::text AS rating, m.fandom, m.language,
                m.word_count, m.cover_media_id, m.current_published_revision_id,
                u.handle AS author_handle
         FROM works w
         JOIN work_fiction_meta m ON m.work_id = w.id
         LEFT JOIN users u ON w.uploader_id = u.id
         WHERE w.gallery = 'fiction'::gallery_kind
           AND w.status = 'approved'::work_status
           AND m.current_published_revision_id IS NOT NULL
           AND m.content_rating = 'all_ages'::content_rating
           AND ($1::text IS NULL OR m.fandom ILIKE '%' || $1 || '%')
           AND ($2::text IS NULL OR w.title ILIKE '%' || $2 || '%' OR m.synopsis ILIKE '%' || $2 || '%')
         ORDER BY w.updated_at DESC
         LIMIT $3 OFFSET $4",
    )
    .bind(fandom)
    .bind(q)
    .bind(limit as i64)
    .bind(offset as i64)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let items = rows
        .iter()
        .map(|row| {
            let synopsis: String = row.try_get("synopsis").unwrap_or_default();
            PublicFictionSummary {
                id: row.try_get("id").unwrap_or_default(),
                title: row.try_get("title").unwrap_or_default(),
                summary: excerpt_from_plain(&synopsis),
                content_kind: ContentKind::Fiction as i32,
                content_rating: map_rating_str(row.try_get("rating").ok()),
                cover_media_id: row
                    .try_get::<Option<Uuid>, _>("cover_media_id")
                    .ok()
                    .flatten()
                    .map(|id| id.to_string())
                    .unwrap_or_default(),
                author_handle: row.try_get("author_handle").unwrap_or_default(),
                fandom: row.try_get("fandom").unwrap_or_default(),
                language: row.try_get("language").unwrap_or_default(),
                word_count: row.try_get("word_count").unwrap_or(0),
                published_revision_id: row
                    .try_get::<Option<Uuid>, _>("current_published_revision_id")
                    .ok()
                    .flatten()
                    .map(|id| id.to_string())
                    .unwrap_or_default(),
            }
        })
        .collect();

    let total_pages = if total == 0 {
        0
    } else {
        ((total as f64) / (limit as f64)).ceil() as u32
    };

    let mut response = protobuf_response(
        StatusCode::OK,
        &PublicFictionListResponse {
            items,
            page,
            limit,
            total,
            total_pages,
        },
    );
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        header::HeaderValue::from_static("public, max-age=60, stale-while-revalidate=120"),
    );
    response
}

async fn get_public_fiction(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(work_id): Path<String>,
) -> impl IntoResponse {
    if let Some(r) = require_accept(&headers) {
        return r;
    }

    let row = sqlx::query(
        "SELECT w.id, w.title, m.synopsis, m.content_rating::text AS rating, m.fandom, m.language,
                m.word_count, m.cover_media_id, m.current_published_revision_id,
                u.handle AS author_handle,
                r.markup_source, r.content_sha256, r.published_at, r.plain_text_projection
         FROM works w
         JOIN work_fiction_meta m ON m.work_id = w.id
         JOIN fiction_revisions r ON r.id = m.current_published_revision_id
         LEFT JOIN users u ON w.uploader_id = u.id
         WHERE w.id = $1
           AND w.gallery = 'fiction'::gallery_kind
           AND w.status = 'approved'::work_status
           AND r.state = 'published'::fiction_revision_state
           AND m.content_rating = 'all_ages'::content_rating",
    )
    .bind(&work_id)
    .fetch_optional(&state.db)
    .await;

    let row = match row {
        Ok(Some(row)) => row,
        Ok(None) => {
            return domain_error(
                StatusCode::NOT_FOUND,
                "not_found",
                "Fiction not found",
            );
        }
        Err(err) => {
            tracing::error!("public fiction detail: {}", err);
            return domain_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal_error",
                "Failed to load fiction",
            );
        }
    };

    let published_at: Option<chrono::DateTime<chrono::Utc>> = row.try_get("published_at").ok();
    let revision_id: Uuid = row
        .try_get("current_published_revision_id")
        .unwrap_or_else(|_| Uuid::nil());
    let body: String = row.try_get("markup_source").unwrap_or_default();
    let sha: String = row.try_get("content_sha256").unwrap_or_default();

    let detail = PublicFictionDetail {
        id: row.try_get("id").unwrap_or_default(),
        title: row.try_get("title").unwrap_or_default(),
        summary: {
            let synopsis: String = row.try_get("synopsis").unwrap_or_default();
            excerpt_from_plain(&synopsis)
        },
        body,
        content_kind: ContentKind::Fiction as i32,
        content_rating: map_rating_str(row.try_get("rating").ok()),
        cover_media_id: row
            .try_get::<Option<Uuid>, _>("cover_media_id")
            .ok()
            .flatten()
            .map(|id| id.to_string())
            .unwrap_or_default(),
        author_handle: row.try_get("author_handle").unwrap_or_default(),
        published_at: published_at
            .map(|v| v.to_rfc3339())
            .unwrap_or_default(),
        fandom: row.try_get("fandom").unwrap_or_default(),
        language: row.try_get("language").unwrap_or_default(),
        word_count: row.try_get("word_count").unwrap_or(0),
        published_revision_id: revision_id.to_string(),
        content_sha256: sha.clone(),
    };

    let mut response = protobuf_response(StatusCode::OK, &detail);
    if !sha.is_empty() {
        if let Ok(etag) = header::HeaderValue::from_str(&format!("\"{}\"", sha)) {
            response.headers_mut().insert(header::ETAG, etag);
        }
    }
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        header::HeaderValue::from_static("public, max-age=60, stale-while-revalidate=120"),
    );
    response
}

async fn create_fiction(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    body: Bytes,
) -> impl IntoResponse {
    if let Some(r) = require_proto_command(&headers) {
        return r;
    }
    let user_id = match require_user(&session).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let req = match CreateFictionRequest::decode(body.as_ref()) {
        Ok(req) => req,
        Err(_) => {
            return domain_error(StatusCode::BAD_REQUEST, "invalid_protobuf", "Invalid body");
        }
    };

    let result = create_fiction_draft(
        &state.db,
        user_id,
        CreateFictionInput {
            title: req.title,
            synopsis: req.synopsis,
            fandom: req.fandom,
            language: req.language,
            content_rating: rating_to_str(req.content_rating).to_string(),
            body: req.body,
        },
    )
    .await;

    match result {
        Ok(created) => no_store(protobuf_response(
            StatusCode::CREATED,
            &CreateFictionResponse {
                work_id: created.work_id,
                revision_id: created.revision_id.to_string(),
                revision_number: created.revision_number,
                word_count: created.word_count,
            },
        )),
        Err(err) => domain_error(err.http_status, err.code, &err.message),
    }
}

async fn save_fiction_draft(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(work_id): Path<String>,
    body: Bytes,
) -> impl IntoResponse {
    if let Some(r) = require_proto_command(&headers) {
        return r;
    }
    let user_id = match require_user(&session).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };
    let req = match SaveFictionDraftRequest::decode(body.as_ref()) {
        Ok(req) => req,
        Err(_) => {
            return domain_error(StatusCode::BAD_REQUEST, "invalid_protobuf", "Invalid body");
        }
    };

    let rating = if req.content_rating == 0 {
        None
    } else {
        Some(rating_to_str(req.content_rating))
    };

    // Always pass synopsis/fandom so authors can intentionally clear them.
    match save_draft_revision(
        &state.db,
        user_id,
        &work_id,
        &req.title,
        &req.body,
        rating,
        Some(req.synopsis.as_str()),
        Some(req.fandom.as_str()),
    )
    .await
    {
        Ok(created) => no_store(protobuf_response(
            StatusCode::OK,
            &SaveFictionDraftResponse {
                work_id: created.work_id,
                revision_id: created.revision_id.to_string(),
                revision_number: created.revision_number,
                word_count: created.word_count,
            },
        )),
        Err(err) => domain_error(err.http_status, err.code, &err.message),
    }
}

async fn submit_fiction(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(work_id): Path<String>,
    body: Bytes,
) -> impl IntoResponse {
    if let Some(r) = require_proto_command(&headers) {
        return r;
    }
    let user_id = match require_user(&session).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };
    let req = match SubmitFictionRequest::decode(body.as_ref()) {
        Ok(req) => req,
        Err(_) => {
            return domain_error(StatusCode::BAD_REQUEST, "invalid_protobuf", "Invalid body");
        }
    };

    let expected_work_version = match req.expected_work_version {
        Some(version) => version,
        None => {
            return domain_error(
                StatusCode::BAD_REQUEST,
                "missing_expected_work_version",
                "expected_work_version is required",
            );
        }
    };

    match submit_revision(&state.db, user_id, &work_id, expected_work_version).await {
        Ok(revision_id) => no_store(protobuf_response(
            StatusCode::OK,
            &SubmitFictionResponse {
                revision_id: revision_id.to_string(),
                state: "pending".into(),
            },
        )),
        Err(err) => domain_error(err.http_status, err.code, &err.message),
    }
}

async fn list_owner_fictions(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Some(r) = require_accept(&headers) {
        return r;
    }
    let user_id = match require_user(&session).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let rows = sqlx::query(
        "SELECT w.id AS work_id, m.version, w.updated_at,
                r.id AS revision_id, r.state::text AS state, r.revision_number,
                r.title, r.synopsis, r.fandom, r.language,
                r.content_rating::text AS rating, r.markup_source, r.created_at
         FROM works w
         JOIN work_fiction_meta m ON m.work_id = w.id
         LEFT JOIN LATERAL (
            SELECT * FROM fiction_revisions fr
            WHERE fr.work_id = w.id
            ORDER BY fr.revision_number DESC
            LIMIT 1
         ) r ON TRUE
         WHERE w.uploader_id = $1 AND w.gallery = 'fiction'::gallery_kind
         ORDER BY w.updated_at DESC
         LIMIT 100",
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let items = rows
        .iter()
        .map(|row| {
            let updated_at: Option<chrono::DateTime<chrono::Utc>> = row
                .try_get("updated_at")
                .ok()
                .or_else(|| row.try_get("created_at").ok());
            OwnerFictionDraft {
                id: row
                    .try_get::<Option<Uuid>, _>("revision_id")
                    .ok()
                    .flatten()
                    .map(|id| id.to_string())
                    .unwrap_or_default(),
                fiction_id: row.try_get("work_id").unwrap_or_default(),
                title: row.try_get("title").unwrap_or_default(),
                body: row.try_get("markup_source").unwrap_or_default(),
                content_rating: map_rating_str(row.try_get("rating").ok()),
                updated_at: updated_at.map(|v| v.to_rfc3339()).unwrap_or_default(),
                state: row.try_get("state").unwrap_or_default(),
                revision_number: row.try_get("revision_number").unwrap_or(0),
                work_version: row.try_get("version").unwrap_or(0),
                synopsis: row.try_get("synopsis").unwrap_or_default(),
                fandom: row.try_get("fandom").unwrap_or_default(),
                language: row.try_get("language").unwrap_or_default(),
            }
        })
        .collect();

    no_store(protobuf_response(
        StatusCode::OK,
        &OwnerFictionListResponse { items },
    ))
}

async fn moderation_queue(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Some(r) = require_accept(&headers) {
        return r;
    }
    let user_id = match require_user(&session).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };
    if let Err(resp) = require_moderator(&state, user_id).await {
        return resp;
    }

    let rows = sqlx::query(
        "SELECT r.id, r.work_id, r.title, r.markup_source, r.revision_number, r.state::text AS state,
                r.created_at, r.word_count, r.plain_text_projection,
                r.content_rating::text AS rating
         FROM fiction_revisions r
         WHERE r.state = 'pending'::fiction_revision_state
         ORDER BY r.submitted_at ASC NULLS LAST, r.created_at ASC
         LIMIT 100",
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let items = rows
        .iter()
        .map(|row| {
            let created_at: Option<chrono::DateTime<chrono::Utc>> = row.try_get("created_at").ok();
            let plain: String = row.try_get("plain_text_projection").unwrap_or_default();
            FictionRevision {
                id: row
                    .try_get::<Uuid, _>("id")
                    .map(|id| id.to_string())
                    .unwrap_or_default(),
                fiction_id: row.try_get("work_id").unwrap_or_default(),
                title: row.try_get("title").unwrap_or_default(),
                body: row.try_get("markup_source").unwrap_or_default(),
                revision_number: row.try_get("revision_number").unwrap_or(0),
                content_rating: map_rating_str(row.try_get("rating").ok()),
                status: row.try_get("state").unwrap_or_default(),
                created_at: created_at.map(|v| v.to_rfc3339()).unwrap_or_default(),
                plain_text_excerpt: excerpt_from_plain(&plain),
                word_count: row.try_get("word_count").unwrap_or(0),
            }
        })
        .collect();

    no_store(protobuf_response(
        StatusCode::OK,
        &ModerationFictionQueueResponse { items },
    ))
}

async fn moderation_decision(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((work_id, revision_id)): Path<(String, String)>,
    body: Bytes,
) -> impl IntoResponse {
    if let Some(r) = require_proto_command(&headers) {
        return r;
    }
    let user_id = match require_user(&session).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };
    if let Err(resp) = require_moderator(&state, user_id).await {
        return resp;
    }

    let revision_uuid = match Uuid::parse_str(&revision_id) {
        Ok(id) => id,
        Err(_) => {
            return domain_error(StatusCode::BAD_REQUEST, "invalid_revision", "Invalid revision id");
        }
    };
    let req = match FictionDecisionRequest::decode(body.as_ref()) {
        Ok(req) => req,
        Err(_) => {
            return domain_error(StatusCode::BAD_REQUEST, "invalid_protobuf", "Invalid body");
        }
    };
    let approve = match FictionDecision::try_from(req.decision) {
        Ok(FictionDecision::Approve) => true,
        Ok(FictionDecision::Reject) => false,
        _ => {
            return domain_error(
                StatusCode::BAD_REQUEST,
                "invalid_decision",
                "decision must be approve or reject",
            );
        }
    };

    match decide_revision(
        &state.db,
        user_id,
        &work_id,
        revision_uuid,
        approve,
        if req.note.is_empty() {
            None
        } else {
            Some(req.note.as_str())
        },
    )
    .await
    {
        Ok(()) => no_store(protobuf_response(
            StatusCode::OK,
            &FictionDecisionResponse {
                work_id,
                revision_id: revision_uuid.to_string(),
                state: if approve {
                    "published".into()
                } else {
                    "rejected".into()
                },
            },
        )),
        Err(err) => domain_error(err.http_status, err.code, &err.message),
    }
}

fn require_accept(headers: &HeaderMap) -> Option<axum::response::Response> {
    if accepts_protobuf(headers) {
        None
    } else {
        Some(not_acceptable("fiction"))
    }
}

fn require_proto_command(headers: &HeaderMap) -> Option<axum::response::Response> {
    if let Some(r) = require_accept(headers) {
        return Some(r);
    }
    if content_type_is_protobuf(headers) {
        None
    } else {
        Some(unsupported_media_type("fiction"))
    }
}

async fn require_user(session: &Session) -> Result<i64, axum::response::Response> {
    match session.get::<i64>(SESSION_USER_ID_KEY).await.ok().flatten() {
        Some(id) => Ok(id),
        None => Err(domain_error(
            StatusCode::UNAUTHORIZED,
            "unauthenticated",
            "Authentication required",
        )),
    }
}

async fn require_moderator(
    state: &AppState,
    user_id: i64,
) -> Result<(), axum::response::Response> {
    let role: Option<String> = sqlx::query_scalar("SELECT role::text FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten();
    match role.as_deref() {
        Some("moderator") | Some("admin") => Ok(()),
        Some(_) => Err(domain_error(
            StatusCode::FORBIDDEN,
            "forbidden",
            "Moderator role required",
        )),
        None => Err(domain_error(
            StatusCode::UNAUTHORIZED,
            "unauthenticated",
            "User not found",
        )),
    }
}

fn domain_error(status: StatusCode, code: &str, message: &str) -> axum::response::Response {
    error_response(
        status,
        code,
        &format!("error.{}", code),
        message,
        "fiction",
        Vec::new(),
    )
}

fn no_store(mut response: axum::response::Response) -> axum::response::Response {
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        header::HeaderValue::from_static("no-store"),
    );
    let _ = PROTO_MEDIA_TYPE;
    response
}

fn map_rating_str(value: Option<String>) -> i32 {
    match value.as_deref() {
        Some("all_ages") => ContentRating::AllAges as i32,
        Some("r15") => ContentRating::R15 as i32,
        Some("r18") => ContentRating::R18 as i32,
        _ => ContentRating::Unspecified as i32,
    }
}

fn rating_to_str(value: i32) -> &'static str {
    match value {
        x if x == ContentRating::R15 as i32 => "r15",
        x if x == ContentRating::R18 as i32 => "r18",
        x if x == ContentRating::AllAges as i32 => "all_ages",
        _ => "all_ages",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use aws_config::BehaviorVersion;
    use aws_sdk_s3::config::{Credentials, Region};
    use sqlx::postgres::PgPoolOptions;
    use tower::ServiceExt;

    use crate::api_v2::codec::PROTO_MEDIA_TYPE;

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
    async fn create_fiction_rejects_oversized_body() {
        let app = fiction_routes()
            .with_state(test_state())
            .layer(tower_sessions::SessionManagerLayer::new(
                tower_sessions::MemoryStore::default(),
            ));
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v2/account/fictions")
                    .header(axum::http::header::ACCEPT, PROTO_MEDIA_TYPE)
                    .header(axum::http::header::CONTENT_TYPE, PROTO_MEDIA_TYPE)
                    .body(Body::from(vec![0u8; FICTION_REVISION_BODY_LIMIT + 1]))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    }
}
