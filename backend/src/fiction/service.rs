//! Fiction revision lifecycle: draft → pending → published (atomic pointer switch).

use sqlx::{PgPool, Postgres, Row, Transaction};
use uuid::Uuid;

use super::markup::{
    validate_fandom, validate_markup, validate_synopsis, validate_title, ValidatedMarkup,
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
        &synopsis,
        &fandom,
        &language,
        rating,
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
    let requested_rating = content_rating
        .map(parse_rating)
        .transpose()?
        .map(str::to_owned);
    let requested_synopsis = synopsis
        .map(validate_synopsis)
        .transpose()
        .map_err(markup_err)?;
    let requested_fandom = fandom
        .map(validate_fandom)
        .transpose()
        .map_err(markup_err)?;

    let mut tx = pool.begin().await.map_err(db_err)?;
    ensure_owner(&mut tx, work_id, author_id).await?;
    sqlx::query_scalar::<_, i64>(
        "SELECT version FROM work_fiction_meta WHERE work_id = $1 FOR UPDATE",
    )
    .bind(work_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(db_err)?
    .ok_or_else(|| DomainError::not_found("Fiction work not found"))?;

    // Update existing draft if present; otherwise create a new revision number.
    let draft = sqlx::query(
        "SELECT id, revision_number, synopsis, fandom, language,
                content_rating::text AS content_rating
         FROM fiction_revisions
         WHERE work_id = $1 AND state = 'draft'::fiction_revision_state
         ORDER BY revision_number DESC LIMIT 1 FOR UPDATE",
    )
    .bind(work_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(db_err)?;

    let (
        revision_id,
        revision_number,
        base_synopsis,
        base_fandom,
        language,
        base_rating,
        draft_exists,
    ) = if let Some(row) = draft {
        (
            row.try_get("id").map_err(db_err)?,
            row.try_get("revision_number").map_err(db_err)?,
            row.try_get("synopsis").map_err(db_err)?,
            row.try_get("fandom").map_err(db_err)?,
            row.try_get::<String, _>("language").map_err(db_err)?,
            row.try_get("content_rating").map_err(db_err)?,
            true,
        )
    } else {
        let row = sqlx::query(
            "SELECT revision_number, synopsis, fandom, language,
                        content_rating::text AS content_rating
                 FROM fiction_revisions
                 WHERE work_id = $1
                 ORDER BY revision_number DESC LIMIT 1 FOR UPDATE",
        )
        .bind(work_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(db_err)?
        .ok_or_else(|| DomainError::not_found("Fiction revision not found"))?;
        (
            Uuid::new_v4(),
            row.try_get::<i32, _>("revision_number").map_err(db_err)? + 1,
            row.try_get("synopsis").map_err(db_err)?,
            row.try_get("fandom").map_err(db_err)?,
            row.try_get::<String, _>("language").map_err(db_err)?,
            row.try_get("content_rating").map_err(db_err)?,
            false,
        )
    };

    let synopsis = requested_synopsis.unwrap_or(base_synopsis);
    let fandom = requested_fandom.unwrap_or(base_fandom);
    let rating = requested_rating.unwrap_or(base_rating);

    if draft_exists {
        sqlx::query(
            "UPDATE fiction_revisions SET
                title = $2,
                markup_source = $3,
                plain_text_projection = $4,
                content_sha256 = $5,
                word_count = $6,
                synopsis = $7,
                fandom = $8,
                language = $9,
                content_rating = $10::content_rating
             WHERE id = $1",
        )
        .bind(revision_id)
        .bind(&title)
        .bind(&validated.markup_source)
        .bind(&validated.plain_text)
        .bind(&validated.content_sha256)
        .bind(validated.word_count)
        .bind(&synopsis)
        .bind(&fandom)
        .bind(&language)
        .bind(&rating)
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;
    } else {
        insert_revision(
            &mut tx,
            revision_id,
            work_id,
            author_id,
            revision_number,
            "draft",
            &title,
            &synopsis,
            &fandom,
            &language,
            &rating,
            &validated,
            None,
        )
        .await?;
    }

    // Touch work row so owner lists and activity ordering refresh without
    // mutating the public published projection.
    sqlx::query("UPDATE works SET updated_at = NOW() WHERE id = $1")
        .bind(work_id)
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

    let meta = sqlx::query(
        "SELECT version, current_published_revision_id IS NOT NULL AS has_published
         FROM work_fiction_meta WHERE work_id = $1 FOR UPDATE",
    )
    .bind(work_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(db_err)?
    .ok_or_else(|| DomainError::not_found("Fiction work not found"))?;
    let version: i64 = meta.try_get("version").map_err(db_err)?;
    let has_published: bool = meta.try_get("has_published").map_err(db_err)?;

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

    if !has_published {
        sqlx::query("UPDATE works SET status = 'pending'::work_status WHERE id = $1")
            .bind(work_id)
            .execute(&mut *tx)
            .await
            .map_err(db_err)?;
    }

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
        "SELECT state::text AS state, work_id, title, synopsis, fandom, language,
                content_rating::text AS content_rating, word_count
         FROM fiction_revisions WHERE id = $1 FOR UPDATE",
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
        let title: String = row.try_get("title").map_err(db_err)?;
        let synopsis: String = row.try_get("synopsis").map_err(db_err)?;
        let fandom: String = row.try_get("fandom").map_err(db_err)?;
        let language: String = row.try_get("language").map_err(db_err)?;
        let rating: String = row.try_get("content_rating").map_err(db_err)?;
        let word_count: i32 = row.try_get("word_count").map_err(db_err)?;

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

        sqlx::query(
            "UPDATE work_fiction_meta SET
                current_published_revision_id = $2,
                word_count = $3,
                synopsis = $4,
                fandom = $5,
                language = $6,
                content_rating = $7::content_rating,
                version = version + 1
             WHERE work_id = $1",
        )
        .bind(work_id)
        .bind(revision_id)
        .bind(word_count)
        .bind(&synopsis)
        .bind(&fandom)
        .bind(&language)
        .bind(&rating)
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;

        sqlx::query(
            "UPDATE works SET
                status = 'approved'::work_status,
                title = $2,
                content_rating = $3::content_rating,
                reviewed_by = $4,
                reviewed_at = NOW(),
                review_note = $5
             WHERE id = $1",
        )
        .bind(work_id)
        .bind(&title)
        .bind(&rating)
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

        if has_published {
            // Repair any replacement submitted before this isolation fix while
            // preserving an independently applied takedown.
            sqlx::query(
                "UPDATE works SET status = 'approved'::work_status
                 WHERE id = $1 AND status = 'pending'::work_status",
            )
            .bind(work_id)
            .execute(&mut *tx)
            .await
            .map_err(db_err)?;
        } else {
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
    synopsis: &str,
    fandom: &str,
    language: &str,
    content_rating: &str,
    validated: &ValidatedMarkup,
    expected_work_version: Option<i64>,
) -> Result<(), DomainError> {
    sqlx::query(
        "INSERT INTO fiction_revisions (
            id, work_id, author_id, revision_number, state, title,
            markup_source, plain_text_projection, content_sha256, word_count,
            synopsis, fandom, language, content_rating, expected_work_version
         ) VALUES (
            $1, $2, $3, $4, $5::fiction_revision_state, $6,
            $7, $8, $9, $10, $11, $12, $13, $14::content_rating, $15
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
    .bind(synopsis)
    .bind(fandom)
    .bind(language)
    .bind(content_rating)
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
        Some(_) => Err(DomainError::forbidden(
            "Only the author can modify this fiction",
        )),
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

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::postgres::PgPoolOptions;

    #[derive(Debug)]
    struct PublicProjection {
        title: String,
        status: String,
        synopsis: String,
        fandom: String,
        language: String,
        rating: String,
        published_revision_id: Uuid,
        published_revision_state: String,
        version: i64,
    }

    #[tokio::test]
    async fn replacement_revision_isolated_until_approval() {
        let Ok(database_url) = std::env::var("DATABASE_URL") else {
            return;
        };
        let pool = PgPoolOptions::new()
            .max_connections(2)
            .connect(&database_url)
            .await
            .expect("DATABASE_URL should point to an available test database");

        let suffix = Uuid::new_v4().simple().to_string();
        let author_id = insert_test_user(&pool, &suffix, "member").await;
        let moderator_id = insert_test_user(&pool, &format!("mod{suffix}"), "moderator").await;

        let created = create_fiction_draft(
            &pool,
            author_id,
            CreateFictionInput {
                title: "Published title".into(),
                synopsis: "Published synopsis".into(),
                fandom: "Published fandom".into(),
                language: "en".into(),
                content_rating: "all_ages".into(),
                body: "Published body".into(),
            },
        )
        .await
        .expect("initial draft should be created");

        let initial_revision = submit_revision(&pool, author_id, &created.work_id, 0)
            .await
            .expect("initial revision should submit");
        decide_revision(
            &pool,
            moderator_id,
            &created.work_id,
            initial_revision,
            true,
            None,
        )
        .await
        .expect("initial revision should publish");

        let published = load_public_projection(&pool, &created.work_id).await;
        assert_eq!(published.title, "Published title");
        assert_eq!(published.synopsis, "Published synopsis");
        assert_eq!(published.rating, "all_ages");
        assert_eq!(published.version, 1);

        let replacement = save_draft_revision(
            &pool,
            author_id,
            &created.work_id,
            "Private replacement",
            "Private replacement body",
            Some("r18"),
            Some("Private synopsis"),
            Some("Private fandom"),
        )
        .await
        .expect("replacement draft should save");

        let revision_snapshot = sqlx::query(
            "SELECT title, synopsis, fandom, language, content_rating::text AS rating
             FROM fiction_revisions WHERE id = $1",
        )
        .bind(replacement.revision_id)
        .fetch_one(&pool)
        .await
        .expect("replacement snapshot should load");
        assert_eq!(
            revision_snapshot
                .try_get::<String, _>("title")
                .expect("title"),
            "Private replacement"
        );
        assert_eq!(
            revision_snapshot
                .try_get::<String, _>("synopsis")
                .expect("synopsis"),
            "Private synopsis"
        );
        assert_eq!(
            revision_snapshot
                .try_get::<String, _>("fandom")
                .expect("fandom"),
            "Private fandom"
        );
        assert_eq!(
            revision_snapshot
                .try_get::<String, _>("language")
                .expect("language"),
            "en"
        );
        assert_eq!(
            revision_snapshot
                .try_get::<String, _>("rating")
                .expect("rating"),
            "r18"
        );
        assert_published_projection_unchanged(
            &load_public_projection(&pool, &created.work_id).await,
            initial_revision,
        );

        let submitted_replacement = submit_revision(&pool, author_id, &created.work_id, 1)
            .await
            .expect("replacement should submit");
        assert_eq!(submitted_replacement, replacement.revision_id);
        assert_published_projection_unchanged(
            &load_public_projection(&pool, &created.work_id).await,
            initial_revision,
        );

        decide_revision(
            &pool,
            moderator_id,
            &created.work_id,
            replacement.revision_id,
            false,
            Some("not yet"),
        )
        .await
        .expect("replacement should reject");
        assert_published_projection_unchanged(
            &load_public_projection(&pool, &created.work_id).await,
            initial_revision,
        );

        let approved_replacement = save_draft_revision(
            &pool,
            author_id,
            &created.work_id,
            "Approved replacement",
            "Approved replacement body",
            Some("all_ages"),
            Some("Approved synopsis"),
            Some("Approved fandom"),
        )
        .await
        .expect("revised replacement should save");
        submit_revision(&pool, author_id, &created.work_id, 1)
            .await
            .expect("revised replacement should submit");
        decide_revision(
            &pool,
            moderator_id,
            &created.work_id,
            approved_replacement.revision_id,
            true,
            None,
        )
        .await
        .expect("revised replacement should publish");

        let switched = load_public_projection(&pool, &created.work_id).await;
        assert_eq!(switched.title, "Approved replacement");
        assert_eq!(switched.synopsis, "Approved synopsis");
        assert_eq!(switched.fandom, "Approved fandom");
        assert_eq!(switched.language, "en");
        assert_eq!(switched.rating, "all_ages");
        assert_eq!(
            switched.published_revision_id,
            approved_replacement.revision_id
        );
        assert_eq!(switched.published_revision_state, "published");
        assert_eq!(switched.status, "approved");
        assert_eq!(switched.version, 2);

        sqlx::query("DELETE FROM works WHERE id = $1")
            .bind(&created.work_id)
            .execute(&pool)
            .await
            .expect("test work should clean up");
        sqlx::query("DELETE FROM users WHERE id = $1 OR id = $2")
            .bind(author_id)
            .bind(moderator_id)
            .execute(&pool)
            .await
            .expect("test users should clean up");
    }

    fn assert_published_projection_unchanged(
        projection: &PublicProjection,
        initial_revision: Uuid,
    ) {
        assert_eq!(projection.title, "Published title");
        assert_eq!(projection.status, "approved");
        assert_eq!(projection.synopsis, "Published synopsis");
        assert_eq!(projection.fandom, "Published fandom");
        assert_eq!(projection.language, "en");
        assert_eq!(projection.rating, "all_ages");
        assert_eq!(projection.published_revision_id, initial_revision);
        assert_eq!(projection.published_revision_state, "published");
        assert_eq!(projection.version, 1);
    }

    async fn load_public_projection(pool: &PgPool, work_id: &str) -> PublicProjection {
        let row = sqlx::query(
            "SELECT w.title, w.status::text AS status, m.synopsis, m.fandom, m.language,
                    m.content_rating::text AS rating, m.current_published_revision_id,
                    r.state::text AS published_revision_state, m.version
             FROM works w
             JOIN work_fiction_meta m ON m.work_id = w.id
             JOIN fiction_revisions r ON r.id = m.current_published_revision_id
             WHERE w.id = $1",
        )
        .bind(work_id)
        .fetch_one(pool)
        .await
        .expect("public projection should load");

        PublicProjection {
            title: row.try_get("title").expect("title"),
            status: row.try_get("status").expect("status"),
            synopsis: row.try_get("synopsis").expect("synopsis"),
            fandom: row.try_get("fandom").expect("fandom"),
            language: row.try_get("language").expect("language"),
            rating: row.try_get("rating").expect("rating"),
            published_revision_id: row
                .try_get("current_published_revision_id")
                .expect("published revision"),
            published_revision_state: row
                .try_get("published_revision_state")
                .expect("published revision state"),
            version: row.try_get("version").expect("version"),
        }
    }

    async fn insert_test_user(pool: &PgPool, suffix: &str, role: &str) -> i64 {
        sqlx::query_scalar(
            "INSERT INTO users (handle, email, password_hash, display_name, role)
             VALUES ($1, $2, 'test', $3, $4::user_role)
             RETURNING id",
        )
        .bind(format!("fiction-{suffix}"))
        .bind(format!("fiction-{suffix}@example.test"))
        .bind(format!("Fiction {suffix}"))
        .bind(role)
        .fetch_one(pool)
        .await
        .expect("test user should insert")
    }
}
