//! Fiction revision lifecycle: draft → pending → published (atomic pointer switch).

use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::markup::{
    ValidatedMarkup, validate_fandom, validate_markup, validate_synopsis, validate_title,
};

#[derive(Debug, Clone)]
pub struct CreateFictionInput {
    pub title: String,
    pub synopsis: String,
    pub fandom: String,
    pub language: String,
    pub content_rating: String,
    pub body: String,
}

#[derive(Debug, Clone)]
pub struct FictionWorkCreated {
    pub work_id: String,
    pub revision_id: Uuid,
    pub revision_number: i32,
    pub word_count: i32,
}

#[derive(Debug, Clone)]
pub struct DomainError {
    pub http_status: axum::http::StatusCode,
    pub code: &'static str,
    pub message: String,
}

impl DomainError {
    fn bad_request(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            http_status: axum::http::StatusCode::BAD_REQUEST,
            code,
            message: message.into(),
        }
    }

    fn forbidden(message: impl Into<String>) -> Self {
        Self {
            http_status: axum::http::StatusCode::FORBIDDEN,
            code: "forbidden",
            message: message.into(),
        }
    }

    fn not_found(message: impl Into<String>) -> Self {
        Self {
            http_status: axum::http::StatusCode::NOT_FOUND,
            code: "not_found",
            message: message.into(),
        }
    }

    fn conflict(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            http_status: axum::http::StatusCode::CONFLICT,
            code,
            message: message.into(),
        }
    }

    fn internal(message: impl Into<String>) -> Self {
        Self {
            http_status: axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            code: "internal_error",
            message: message.into(),
        }
    }
}

fn parse_rating(value: &str) -> Result<&'static str, DomainError> {
    match value {
        "all_ages" | "CONTENT_RATING_ALL_AGES" => Ok("all_ages"),
        "r15" | "CONTENT_RATING_R15" => Ok("r15"),
        "r18" | "CONTENT_RATING_R18" => Ok("r18"),
        _ => Err(DomainError::bad_request(
            "invalid_rating",
            "content_rating must be all_ages, r15, or r18",
        )),
    }
}

pub async fn create_fiction_draft(
    pool: &PgPool,
    author_id: i64,
    input: CreateFictionInput,
) -> Result<FictionWorkCreated, DomainError> {
    let title = validate_title(&input.title).map_err(markup_err)?;
    let synopsis = validate_synopsis(&input.synopsis).map_err(markup_err)?;
    let fandom = validate_fandom(&input.fandom).map_err(markup_err)?;
    let rating = parse_rating(&input.content_rating)?;
    let language = if input.language.trim().is_empty() {
        "zh-Hans".to_string()
    } else {
        input.language.trim().chars().take(32).collect()
    };
    let validated = validate_markup(&input.body).map_err(markup_err)?;
    // Slice C: media refs validated for shape only; ownership checks land with media UUID slice.
    let _ = &validated.media_ids;

    let work_id = Uuid::new_v4().to_string();
    let revision_id = Uuid::new_v4();

    let mut tx = pool.begin().await.map_err(db_err)?;

    sqlx::query(
        "INSERT INTO works (
            id, gallery, origin, title, status, uploader_id,
            file, asset_file, width, height, source, source_url, rights_note,
            content_kind, content_rating
         ) VALUES (
            $1, 'fiction'::gallery_kind, NULL, $2, 'pending'::work_status, $3,
            NULL, NULL, 1, 1, '', '', '',
            'fiction'::content_kind, $4::content_rating
         )",
    )
    .bind(&work_id)
    .bind(&title)
    .bind(author_id)
    .bind(rating)
    .execute(&mut *tx)
    .await
    .map_err(db_err)?;

    sqlx::query(
        "INSERT INTO work_fiction_meta (
            work_id, language, fandom, synopsis, content_rating, word_count, version
         ) VALUES ($1, $2, $3, $4, $5::content_rating, $6, 0)",
    )
    .bind(&work_id)
    .bind(&language)
    .bind(&fandom)
    .bind(&synopsis)
    .bind(rating)
    .bind(validated.word_count)
    .execute(&mut *tx)
    .await
    .map_err(db_err)?;

    insert_revision(
        &mut tx,
        revision_id,
        &work_id,
        author_id,
        1,
        "draft",
        &title,
        &validated,
        None,
    )
    .await?;

    tx.commit().await.map_err(db_err)?;

    Ok(FictionWorkCreated {
        work_id,
        revision_id,
        revision_number: 1,
        word_count: validated.word_count,
    })
}

pub async fn save_draft_revision(
    pool: &PgPool,
    author_id: i64,
    work_id: &str,
    title: &str,
    body: &str,
    content_rating: Option<&str>,
    synopsis: Option<&str>,
    fandom: Option<&str>,
) -> Result<FictionWorkCreated, DomainError> {
    let title = validate_title(title).map_err(markup_err)?;
    let validated = validate_markup(body).map_err(markup_err)?;

    let mut tx = pool.begin().await.map_err(db_err)?;
    ensure_owner(&mut tx, work_id, author_id).await?;

    if let Some(rating) = content_rating {
        let rating = parse_rating(rating)?;
        sqlx::query(
            "UPDATE work_fiction_meta SET content_rating = $2::content_rating WHERE work_id = $1",
        )
        .bind(work_id)
        .bind(rating)
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;
        sqlx::query("UPDATE works SET content_rating = $2::content_rating, title = $3 WHERE id = $1")
            .bind(work_id)
            .bind(rating)
            .bind(&title)
            .execute(&mut *tx)
            .await
            .map_err(db_err)?;
    } else {
        sqlx::query("UPDATE works SET title = $2 WHERE id = $1")
            .bind(work_id)
            .bind(&title)
            .execute(&mut *tx)
            .await
            .map_err(db_err)?;
    }

    if let Some(synopsis) = synopsis {
        let synopsis = validate_synopsis(synopsis).map_err(markup_err)?;
        sqlx::query("UPDATE work_fiction_meta SET synopsis = $2 WHERE work_id = $1")
            .bind(work_id)
            .bind(synopsis)
            .execute(&mut *tx)
            .await
            .map_err(db_err)?;
    }
    if let Some(fandom) = fandom {
        let fandom = validate_fandom(fandom).map_err(markup_err)?;
        sqlx::query("UPDATE work_fiction_meta SET fandom = $2 WHERE work_id = $1")
            .bind(work_id)
            .bind(fandom)
            .execute(&mut *tx)
            .await
            .map_err(db_err)?;
    }

    // Update existing draft if present; otherwise create a new revision number.
    let draft_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM fiction_revisions
         WHERE work_id = $1 AND state = 'draft'::fiction_revision_state
         ORDER BY revision_number DESC LIMIT 1",
    )
    .bind(work_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(db_err)?;

    let (revision_id, revision_number) = if let Some(id) = draft_id {
        sqlx::query(
            "UPDATE fiction_revisions SET
                title = $2,
                markup_source = $3,
                plain_text_projection = $4,
                content_sha256 = $5,
                word_count = $6
             WHERE id = $1",
        )
        .bind(id)
        .bind(&title)
        .bind(&validated.markup_source)
        .bind(&validated.plain_text)
        .bind(&validated.content_sha256)
        .bind(validated.word_count)
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;
        let num: i32 = sqlx::query_scalar("SELECT revision_number FROM fiction_revisions WHERE id = $1")
            .bind(id)
            .fetch_one(&mut *tx)
            .await
            .map_err(db_err)?;
        (id, num)
    } else {
        let next: i32 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(revision_number), 0) + 1 FROM fiction_revisions WHERE work_id = $1",
        )
        .bind(work_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(db_err)?;
        let id = Uuid::new_v4();
        insert_revision(
            &mut tx,
            id,
            work_id,
            author_id,
            next,
            "draft",
            &title,
            &validated,
            None,
        )
        .await?;
        (id, next)
    };

    sqlx::query("UPDATE work_fiction_meta SET word_count = $2 WHERE work_id = $1")
        .bind(work_id)
        .bind(validated.word_count)
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;

    tx.commit().await.map_err(db_err)?;
    Ok(FictionWorkCreated {
        work_id: work_id.to_string(),
        revision_id,
        revision_number,
        word_count: validated.word_count,
    })
}

pub async fn submit_revision(
    pool: &PgPool,
    author_id: i64,
    work_id: &str,
    expected_work_version: i64,
) -> Result<Uuid, DomainError> {
    let mut tx = pool.begin().await.map_err(db_err)?;
    ensure_owner(&mut tx, work_id, author_id).await?;

    let version: i64 = sqlx::query_scalar("SELECT version FROM work_fiction_meta WHERE work_id = $1")
        .bind(work_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(db_err)?
        .ok_or_else(|| DomainError::not_found("Fiction work not found"))?;

    if version != expected_work_version {
        return Err(DomainError::conflict(
            "version_conflict",
            format!(
                "expected work version {}, found {}",
                expected_work_version, version
            ),
        ));
    }

    let draft_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM fiction_revisions
         WHERE work_id = $1 AND state = 'draft'::fiction_revision_state
         ORDER BY revision_number DESC LIMIT 1 FOR UPDATE",
    )
    .bind(work_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(db_err)?;

    let draft_id = draft_id.ok_or_else(|| {
        DomainError::bad_request("no_draft", "No draft revision available to submit")
    })?;

    // Only one pending revision at a time.
    let pending: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM fiction_revisions
         WHERE work_id = $1 AND state = 'pending'::fiction_revision_state LIMIT 1",
    )
    .bind(work_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(db_err)?;
    if pending.is_some() {
        return Err(DomainError::conflict(
            "pending_exists",
            "A revision is already pending review",
        ));
    }

    sqlx::query(
        "UPDATE fiction_revisions SET
            state = 'pending'::fiction_revision_state,
            submitted_at = NOW(),
            expected_work_version = $2
         WHERE id = $1",
    )
    .bind(draft_id)
    .bind(expected_work_version)
    .execute(&mut *tx)
    .await
    .map_err(db_err)?;

    sqlx::query("UPDATE works SET status = 'pending'::work_status WHERE id = $1")
        .bind(work_id)
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;

    sqlx::query(
        "INSERT INTO moderation_log (work_id, actor_id, action, note)
         VALUES ($1, $2, 'fiction_submit', $3)",
    )
    .bind(work_id)
    .bind(author_id)
    .bind(format!("revision {}", draft_id))
    .execute(&mut *tx)
    .await
    .map_err(db_err)?;

    tx.commit().await.map_err(db_err)?;
    Ok(draft_id)
}

pub async fn decide_revision(
    pool: &PgPool,
    moderator_id: i64,
    work_id: &str,
    revision_id: Uuid,
    approve: bool,
    note: Option<&str>,
) -> Result<(), DomainError> {
    let mut tx = pool.begin().await.map_err(db_err)?;

    let row = sqlx::query(
        "SELECT state::text AS state, work_id FROM fiction_revisions WHERE id = $1 FOR UPDATE",
    )
    .bind(revision_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(db_err)?
    .ok_or_else(|| DomainError::not_found("Revision not found"))?;

    let state: String = row.try_get("state").map_err(db_err)?;
    let row_work_id: String = row.try_get("work_id").map_err(db_err)?;
    if row_work_id != work_id {
        return Err(DomainError::not_found("Revision does not belong to work"));
    }
    if state != "pending" {
        return Err(DomainError::conflict(
            "invalid_revision_state",
            format!("Revision state is {}, expected pending", state),
        ));
    }

    let note = note.map(str::trim).filter(|v| !v.is_empty());

    if approve {
        // Atomic publish: switch pointer and bump version; previous published remains history.
        sqlx::query(
            "UPDATE fiction_revisions SET
                state = 'published'::fiction_revision_state,
                reviewed_at = NOW(),
                published_at = NOW(),
                review_note = $2
             WHERE id = $1",
        )
        .bind(revision_id)
        .bind(note)
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;

        // Demote any other published revision on this work to withdrawn (history retained).
        sqlx::query(
            "UPDATE fiction_revisions SET state = 'withdrawn'::fiction_revision_state
             WHERE work_id = $1
               AND id <> $2
               AND state = 'published'::fiction_revision_state",
        )
        .bind(work_id)
        .bind(revision_id)
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;

        let word_count: i32 =
            sqlx::query_scalar("SELECT word_count FROM fiction_revisions WHERE id = $1")
                .bind(revision_id)
                .fetch_one(&mut *tx)
                .await
                .map_err(db_err)?;
        let title: String = sqlx::query_scalar("SELECT title FROM fiction_revisions WHERE id = $1")
            .bind(revision_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(db_err)?;

        sqlx::query(
            "UPDATE work_fiction_meta SET
                current_published_revision_id = $2,
                word_count = $3,
                version = version + 1
             WHERE work_id = $1",
        )
        .bind(work_id)
        .bind(revision_id)
        .bind(word_count)
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;

        sqlx::query(
            "UPDATE works SET
                status = 'approved'::work_status,
                title = $2,
                reviewed_by = $3,
                reviewed_at = NOW(),
                review_note = $4
             WHERE id = $1",
        )
        .bind(work_id)
        .bind(title)
        .bind(moderator_id)
        .bind(note)
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;

        sqlx::query(
            "INSERT INTO moderation_log (work_id, actor_id, action, note)
             VALUES ($1, $2, 'fiction_approve', $3)",
        )
        .bind(work_id)
        .bind(moderator_id)
        .bind(note.unwrap_or("approved"))
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;
    } else {
        sqlx::query(
            "UPDATE fiction_revisions SET
                state = 'rejected'::fiction_revision_state,
                reviewed_at = NOW(),
                review_note = $2
             WHERE id = $1",
        )
        .bind(revision_id)
        .bind(note)
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;

        // If no published revision remains, mark work rejected; else keep approved.
        let has_published: bool = sqlx::query_scalar(
            "SELECT EXISTS(
                SELECT 1 FROM work_fiction_meta
                WHERE work_id = $1 AND current_published_revision_id IS NOT NULL
             )",
        )
        .bind(work_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(db_err)?;

        if !has_published {
            sqlx::query(
                "UPDATE works SET
                    status = 'rejected'::work_status,
                    reviewed_by = $2,
                    reviewed_at = NOW(),
                    review_note = $3
                 WHERE id = $1",
            )
            .bind(work_id)
            .bind(moderator_id)
            .bind(note)
            .execute(&mut *tx)
            .await
            .map_err(db_err)?;
        }

        sqlx::query(
            "INSERT INTO moderation_log (work_id, actor_id, action, note)
             VALUES ($1, $2, 'fiction_reject', $3)",
        )
        .bind(work_id)
        .bind(moderator_id)
        .bind(note.unwrap_or("rejected"))
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;
    }

    tx.commit().await.map_err(db_err)?;
    Ok(())
}

async fn insert_revision(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    work_id: &str,
    author_id: i64,
    revision_number: i32,
    state: &str,
    title: &str,
    validated: &ValidatedMarkup,
    expected_work_version: Option<i64>,
) -> Result<(), DomainError> {
    sqlx::query(
        "INSERT INTO fiction_revisions (
            id, work_id, author_id, revision_number, state, title,
            markup_source, plain_text_projection, content_sha256, word_count,
            expected_work_version
         ) VALUES (
            $1, $2, $3, $4, $5::fiction_revision_state, $6,
            $7, $8, $9, $10, $11
         )",
    )
    .bind(id)
    .bind(work_id)
    .bind(author_id)
    .bind(revision_number)
    .bind(state)
    .bind(title)
    .bind(&validated.markup_source)
    .bind(&validated.plain_text)
    .bind(&validated.content_sha256)
    .bind(validated.word_count)
    .bind(expected_work_version)
    .execute(&mut **tx)
    .await
    .map_err(db_err)?;
    Ok(())
}

async fn ensure_owner(
    tx: &mut Transaction<'_, Postgres>,
    work_id: &str,
    author_id: i64,
) -> Result<(), DomainError> {
    let owner: Option<i64> = sqlx::query_scalar(
        "SELECT uploader_id FROM works
         WHERE id = $1 AND gallery = 'fiction'::gallery_kind",
    )
    .bind(work_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(db_err)?;

    match owner {
        Some(id) if id == author_id => Ok(()),
        Some(_) => Err(DomainError::forbidden("Only the author can modify this fiction")),
        None => Err(DomainError::not_found("Fiction work not found")),
    }
}

fn markup_err(err: super::markup::MarkupError) -> DomainError {
    DomainError::bad_request(err.code, err.message)
}

fn db_err(err: impl std::fmt::Display) -> DomainError {
    tracing::error!("fiction domain db error: {}", err);
    DomainError::internal("Database operation failed")
}

// sqlx::Row for try_get in decide_revision
use sqlx::Row;
