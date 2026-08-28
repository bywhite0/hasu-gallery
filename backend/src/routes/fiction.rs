// Fiction JSON routes (Architecture V3 S1): public reads, owner drafts, and
// moderation decisions. Transport-only layer over crate::fiction::service.

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, Path, Query, State},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
    routing::{get, post, put},
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tower_sessions::Session;
use uuid::Uuid;

use crate::AppState;
use crate::fiction::{
    CreateFictionInput, create_fiction_draft, decide_revision, excerpt_from_plain,
    save_draft_revision, submit_revision,
};
use crate::routes::auth::SESSION_USER_ID_KEY;

const MAX_PAGE: u32 = 50;
// Architecture V3 §4: Fiction revision bodies need 2 MiB markup headroom + envelope.
const FICTION_REVISION_BODY_LIMIT: usize = 2 * 1024 * 1024 + 64 * 1024;
// Architecture V3 §4: non-revision command default body limit.
const SMALL_COMMAND_BODY_LIMIT: usize = 64 * 1024;

#[derive(Debug, Deserialize)]
pub struct PublicFictionListQuery {
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub q: Option<String>,
    pub fandom: Option<String>,
}

#[derive(Serialize)]
struct PublicFictionSummary {
    id: String,
    title: String,
    summary: String,
    content_rating: String,
    cover_media_id: Option<String>,
    author_handle: String,
    fandom: String,
    language: String,
    word_count: i32,
    published_revision_id: String,
}

#[derive(Serialize)]
struct PublicFictionListResponse {
    items: Vec<PublicFictionSummary>,
    page: u32,
    limit: u32,
    total: i64,
    total_pages: u32,
}

#[derive(Serialize)]
struct PublicFictionDetail {
    id: String,
    title: String,
    summary: String,
    body: String,
    content_rating: String,
    cover_media_id: Option<String>,
    author_handle: String,
    published_at: Option<String>,
    fandom: String,
    language: String,
    word_count: i32,
    published_revision_id: String,
    content_sha256: String,
}

#[derive(Serialize)]
struct OwnerFictionDraft {
    id: String,
    fiction_id: String,
    title: String,
    body: String,
    content_rating: String,
    updated_at: Option<String>,
    state: String,
    revision_number: i32,
    work_version: i64,
    synopsis: String,
    fandom: String,
    language: String,
}

#[derive(Serialize)]
struct OwnerFictionListResponse {
    items: Vec<OwnerFictionDraft>,
}

#[derive(Serialize)]
struct FictionRevision {
    id: String,
    fiction_id: String,
    title: String,
    body: String,
    revision_number: i32,
    content_rating: String,
    status: String,
    created_at: Option<String>,
    plain_text_excerpt: String,
    word_count: i32,
}

#[derive(Serialize)]
struct ModerationFictionQueueResponse {
    items: Vec<FictionRevision>,
}

#[derive(Deserialize)]
pub struct CreateFictionRequest {
    title: String,
    #[serde(default)]
    synopsis: String,
    #[serde(default)]
    fandom: String,
    #[serde(default)]
    language: String,
    content_rating: Option<String>,
    body: String,
}

#[derive(Serialize)]
struct RevisionWriteResponse {
    work_id: String,
    revision_id: String,
    revision_number: i32,
    word_count: i32,
}

#[derive(Deserialize)]
pub struct SaveFictionDraftRequest {
    title: String,
    #[serde(default)]
    synopsis: String,
    #[serde(default)]
    fandom: String,
    content_rating: Option<String>,
    body: String,
}

#[derive(Deserialize)]
pub struct SubmitFictionRequest {
    expected_work_version: Option<i64>,
}

#[derive(Serialize)]
struct SubmitFictionResponse {
    revision_id: String,
    state: String,
}

#[derive(Deserialize)]
pub struct FictionDecisionRequest {
    decision: String,
    #[serde(default)]
    note: String,
}

#[derive(Serialize)]
struct FictionDecisionResponse {
    work_id: String,
    revision_id: String,
    state: String,
}

#[derive(Serialize)]
struct FictionError {
    code: String,
    message: String,
}

pub fn fiction_routes(command_limiter: crate::middleware::RateLimiter) -> Router<AppState> {
    // Bounded per-route token bucket on Fiction write commands, layered on top of
    // the body limit; the rate check runs outermost (before the body is read).
    // The rate_limit key includes the method, so the GET list sharing the
    // users/me/fictions path is bucketed independently from the POST create.
    let rate_limit = |limiter: crate::middleware::RateLimiter| {
        axum::middleware::from_fn_with_state(limiter, crate::middleware::rate_limit)
    };
    Router::new()
        .route("/api/fictions", get(list_public_fictions))
        .route("/api/fictions/:work_id", get(get_public_fiction))
        .route(
            "/api/users/me/fictions",
            get(list_owner_fictions)
                .post(create_fiction)
                .layer(DefaultBodyLimit::max(FICTION_REVISION_BODY_LIMIT))
                .layer(rate_limit(command_limiter.clone())),
        )
        .route(
            "/api/users/me/fictions/:work_id/draft",
            put(save_fiction_draft)
                .layer(DefaultBodyLimit::max(FICTION_REVISION_BODY_LIMIT))
                .layer(rate_limit(command_limiter.clone())),
        )
        .route(
            "/api/users/me/fictions/:work_id/submit",
            post(submit_fiction)
                .layer(DefaultBodyLimit::max(SMALL_COMMAND_BODY_LIMIT))
                .layer(rate_limit(command_limiter.clone())),
        )
        .route("/api/moderation/fictions", get(moderation_queue))
        .route(
            "/api/moderation/fictions/:work_id/revisions/:revision_id/decision",
            post(moderation_decision)
                .layer(DefaultBodyLimit::max(SMALL_COMMAND_BODY_LIMIT))
                .layer(rate_limit(command_limiter.clone())),
        )
}

async fn list_public_fictions(
    State(state): State<AppState>,
    Query(params): Query<PublicFictionListQuery>,
) -> impl IntoResponse {
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
                content_rating: rating_string(row.try_get("rating").ok()),
                cover_media_id: row
                    .try_get::<Option<Uuid>, _>("cover_media_id")
                    .ok()
                    .flatten()
                    .map(|id| id.to_string()),
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

    let mut response = Json(PublicFictionListResponse {
        items,
        page,
        limit,
        total,
        total_pages,
    })
    .into_response();
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        header::HeaderValue::from_static("public, max-age=60, stale-while-revalidate=120"),
    );
    response
}

async fn get_public_fiction(
    State(state): State<AppState>,
    Path(work_id): Path<String>,
) -> impl IntoResponse {
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
            return fiction_error(StatusCode::NOT_FOUND, "not_found", "Fiction not found");
        }
        Err(err) => {
            tracing::error!("public fiction detail: {}", err);
            return fiction_error(
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
        content_rating: rating_string(row.try_get("rating").ok()),
        cover_media_id: row
            .try_get::<Option<Uuid>, _>("cover_media_id")
            .ok()
            .flatten()
            .map(|id| id.to_string()),
        author_handle: row.try_get("author_handle").unwrap_or_default(),
        published_at: published_at.map(|v| v.to_rfc3339()),
        fandom: row.try_get("fandom").unwrap_or_default(),
        language: row.try_get("language").unwrap_or_default(),
        word_count: row.try_get("word_count").unwrap_or(0),
        published_revision_id: revision_id.to_string(),
        content_sha256: sha.clone(),
    };

    let mut response = Json(detail).into_response();
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
    Json(req): Json<CreateFictionRequest>,
) -> impl IntoResponse {
    let user_id = match require_user(&session).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let content_rating = match validate_rating(req.content_rating.as_deref()) {
        Ok(rating) => rating.unwrap_or("all_ages").to_string(),
        Err(resp) => return resp,
    };

    let result = create_fiction_draft(
        &state.db,
        user_id,
        CreateFictionInput {
            title: req.title,
            synopsis: req.synopsis,
            fandom: req.fandom,
            language: req.language,
            content_rating,
            body: req.body,
        },
    )
    .await;

    match result {
        Ok(created) => no_store(
            (
                StatusCode::CREATED,
                Json(RevisionWriteResponse {
                    work_id: created.work_id,
                    revision_id: created.revision_id.to_string(),
                    revision_number: created.revision_number,
                    word_count: created.word_count,
                }),
            )
                .into_response(),
        ),
        Err(err) => fiction_error(err.http_status, err.code, &err.message),
    }
}

async fn save_fiction_draft(
    State(state): State<AppState>,
    session: Session,
    Path(work_id): Path<String>,
    Json(req): Json<SaveFictionDraftRequest>,
) -> impl IntoResponse {
    let user_id = match require_user(&session).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };
    let rating = match validate_rating(req.content_rating.as_deref()) {
        Ok(rating) => rating,
        Err(resp) => return resp,
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
        Ok(created) => no_store(
            Json(RevisionWriteResponse {
                work_id: created.work_id,
                revision_id: created.revision_id.to_string(),
                revision_number: created.revision_number,
                word_count: created.word_count,
            })
            .into_response(),
        ),
        Err(err) => fiction_error(err.http_status, err.code, &err.message),
    }
}

async fn submit_fiction(
    State(state): State<AppState>,
    session: Session,
    Path(work_id): Path<String>,
    Json(req): Json<SubmitFictionRequest>,
) -> impl IntoResponse {
    let user_id = match require_user(&session).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let expected_work_version = match req.expected_work_version {
        Some(version) => version,
        None => {
            return fiction_error(
                StatusCode::BAD_REQUEST,
                "missing_expected_work_version",
                "expected_work_version is required",
            );
        }
    };

    match submit_revision(&state.db, user_id, &work_id, expected_work_version).await {
        Ok(revision_id) => no_store(
            Json(SubmitFictionResponse {
                revision_id: revision_id.to_string(),
                state: "pending".into(),
            })
            .into_response(),
        ),
        Err(err) => fiction_error(err.http_status, err.code, &err.message),
    }
}

async fn list_owner_fictions(
    State(state): State<AppState>,
    session: Session,
) -> impl IntoResponse {
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
                content_rating: rating_string(row.try_get("rating").ok()),
                updated_at: updated_at.map(|v| v.to_rfc3339()),
                state: row.try_get("state").unwrap_or_default(),
                revision_number: row.try_get("revision_number").unwrap_or(0),
                work_version: row.try_get("version").unwrap_or(0),
                synopsis: row.try_get("synopsis").unwrap_or_default(),
                fandom: row.try_get("fandom").unwrap_or_default(),
                language: row.try_get("language").unwrap_or_default(),
            }
        })
        .collect();

    no_store(Json(OwnerFictionListResponse { items }).into_response())
}

async fn moderation_queue(
    State(state): State<AppState>,
    session: Session,
) -> impl IntoResponse {
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
                content_rating: rating_string(row.try_get("rating").ok()),
                status: row.try_get("state").unwrap_or_default(),
                created_at: created_at.map(|v| v.to_rfc3339()),
                plain_text_excerpt: excerpt_from_plain(&plain),
                word_count: row.try_get("word_count").unwrap_or(0),
            }
        })
        .collect();

    no_store(Json(ModerationFictionQueueResponse { items }).into_response())
}

async fn moderation_decision(
    State(state): State<AppState>,
    session: Session,
    Path((work_id, revision_id)): Path<(String, String)>,
    Json(req): Json<FictionDecisionRequest>,
) -> impl IntoResponse {
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
            return fiction_error(StatusCode::BAD_REQUEST, "invalid_revision", "Invalid revision id");
        }
    };
    let approve = match req.decision.as_str() {
        "approve" => true,
        "reject" => false,
        _ => {
            return fiction_error(
                StatusCode::BAD_REQUEST,
                "invalid_decision",
                "decision must be approve or reject",
            );
        }
    };

    let note = req.note.trim();
    match decide_revision(
        &state.db,
        user_id,
        &work_id,
        revision_uuid,
        approve,
        if note.is_empty() { None } else { Some(note) },
    )
    .await
    {
        Ok(()) => no_store(
            Json(FictionDecisionResponse {
                work_id,
                revision_id: revision_uuid.to_string(),
                state: if approve {
                    "published".into()
                } else {
                    "rejected".into()
                },
            })
            .into_response(),
        ),
        Err(err) => fiction_error(err.http_status, err.code, &err.message),
    }
}

async fn require_user(session: &Session) -> Result<i64, Response> {
    let user_id = session.get::<i64>(SESSION_USER_ID_KEY).await.ok().flatten();
    let principal = crate::policy::Principal {
        user_id,
        role: None,
    };
    if crate::policy::decide(&principal, crate::policy::Action::SubmitContent)
        != crate::policy::Decision::Allow
    {
        return Err(fiction_error(
            StatusCode::UNAUTHORIZED,
            "unauthenticated",
            "Authentication required",
        ));
    }
    Ok(user_id.expect("SubmitContent only allows signed-in principals"))
}

async fn require_moderator(state: &AppState, user_id: i64) -> Result<(), Response> {
    let role: Option<String> = sqlx::query_scalar("SELECT role::text FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten();
    let Some(role) = role else {
        return Err(fiction_error(
            StatusCode::UNAUTHORIZED,
            "unauthenticated",
            "User not found",
        ));
    };
    let principal = crate::policy::Principal {
        user_id: Some(user_id),
        role: crate::policy::Role::parse(&role),
    };
    match crate::policy::decide(&principal, crate::policy::Action::Moderate) {
        crate::policy::Decision::Allow => Ok(()),
        _ => Err(fiction_error(
            StatusCode::FORBIDDEN,
            "forbidden",
            "Moderator role required",
        )),
    }
}

fn validate_rating(value: Option<&str>) -> Result<Option<&str>, Response> {
    match value {
        None => Ok(None),
        Some("all_ages") | Some("r15") | Some("r18") => Ok(value),
        Some(_) => Err(fiction_error(
            StatusCode::BAD_REQUEST,
            "invalid_content_rating",
            "content_rating must be all_ages, r15, or r18",
        )),
    }
}

fn fiction_error(status: StatusCode, code: &str, message: &str) -> Response {
    let mut response = (
        status,
        Json(FictionError {
            code: code.to_string(),
            message: message.to_string(),
        }),
    )
        .into_response();
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        header::HeaderValue::from_static("no-store"),
    );
    response
}

fn no_store(mut response: Response) -> Response {
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        header::HeaderValue::from_static("no-store"),
    );
    response
}

fn rating_string(value: Option<String>) -> String {
    match value.as_deref() {
        Some("r15") => "r15".to_string(),
        Some("r18") => "r18".to_string(),
        _ => "all_ages".to_string(),
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

    fn test_app() -> Router {
        fiction_routes(crate::middleware::RateLimiter::with_options(
            1000,
            std::time::Duration::from_secs(60),
            100,
            false,
        ))
        .with_state(test_state())
        .layer(tower_sessions::SessionManagerLayer::new(
            tower_sessions::MemoryStore::default(),
        ))
    }

    #[tokio::test]
    async fn create_fiction_rejects_oversized_body() {
        let app = test_app();
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/users/me/fictions")
                    .header(axum::http::header::CONTENT_TYPE, "application/json")
                    .body(Body::from(vec![b' '; FICTION_REVISION_BODY_LIMIT + 1]))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    }

    #[tokio::test]
    async fn create_fiction_requires_json_content_type() {
        let app = test_app();
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/users/me/fictions")
                    .header(axum::http::header::CONTENT_TYPE, "text/plain")
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNSUPPORTED_MEDIA_TYPE);
    }

    #[tokio::test]
    async fn fiction_create_rate_limited_after_threshold() {
        // Small bucket (2) so the third write is rejected with 429.
        let app = fiction_routes(crate::middleware::RateLimiter::with_options(
            2,
            std::time::Duration::from_secs(60),
            100,
            false,
        ))
        .with_state(test_state())
        .layer(tower_sessions::SessionManagerLayer::new(
            tower_sessions::MemoryStore::default(),
        ));

        let mut statuses = Vec::new();
        for _ in 0..3 {
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/users/me/fictions")
                        .header(axum::http::header::CONTENT_TYPE, "application/json")
                        .body(Body::from("{}"))
                        .unwrap(),
                )
                .await
                .unwrap();
            statuses.push(response.status());
        }

        // First two pass the limiter (then fail auth/validation); the third is throttled.
        assert_ne!(statuses[0], StatusCode::TOO_MANY_REQUESTS);
        assert_ne!(statuses[1], StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(statuses[2], StatusCode::TOO_MANY_REQUESTS);
    }
}
