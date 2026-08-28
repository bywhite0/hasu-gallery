use axum::{extract::State, http::{StatusCode, Uri}, response::IntoResponse, Json};
use axum_extra::extract::Multipart;
use serde_json::json;
use sha2::{Digest, Sha256};
use sqlx::Row;
use tower_sessions::Session;
use uuid::Uuid;

use crate::{
    image_processor::{
        detect_image_format, generate_thumbnail, get_image_dimensions, prepare_public_original,
    },
    media, storage, AppState,
};

const SESSION_USER_ID_KEY: &str = "user_id";
const MAX_FILE_SIZE: usize = 10 * 1024 * 1024; // 10MB
// Route-level body cap. Axum's default is 2MB, which silently rejected any
// upload above it before the handler's own MAX_FILE_SIZE check could run.
// The 512KB headroom covers multipart boundaries and text fields so a file
// of exactly MAX_FILE_SIZE still reaches the handler's 413 check.
pub(crate) const UPLOAD_BODY_LIMIT: usize = MAX_FILE_SIZE + 512 * 1024;
const THUMBNAIL_SIZE: u32 = 400;
const MAX_TITLE_LEN: usize = 200;
const MAX_ARTIST_LEN: usize = 200;
const MAX_MEDIUM_LEN: usize = 100;
const MAX_SOURCE_LEN: usize = 2_000;
const MAX_SOURCE_URL_LEN: usize = 2_048;

/// 上传作品
pub async fn upload_work(
    State(state): State<AppState>,
    session: Session,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // 验证登录
    let user_id: i64 = session
        .get(SESSION_USER_ID_KEY)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Not authenticated".to_string()))?;

    let mut file_data: Option<Vec<u8>> = None;
    let mut file_name: Option<String> = None;
    let mut title: Option<String> = None;
    let mut gallery: Option<String> = None;
    let mut origin: Option<String> = None;
    let mut source: Option<String> = None;
    let mut source_url: Option<String> = None;
    let mut artist: Option<String> = None;
    let mut medium: Option<String> = None;
    let mut rating: Option<String> = None;

    // 解析 multipart 数据
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            format!("Failed to read field: {}", e),
        )
    })? {
        let name = field.name().unwrap_or("").to_string();

        match name.as_str() {
            "file" => {
                file_name = field.file_name().map(ToString::to_string);
                let data = field
                    .bytes()
                    .await
                    .map_err(|e| {
                        (
                            StatusCode::BAD_REQUEST,
                            format!("Failed to read file: {}", e),
                        )
                    })?
                    .to_vec();

                if data.len() > MAX_FILE_SIZE {
                    return Err((
                        StatusCode::PAYLOAD_TOO_LARGE,
                        format!("File size exceeds {}MB limit", MAX_FILE_SIZE / 1024 / 1024),
                    ));
                }

                file_data = Some(data);
            }
            "title" => {
                let text: String = field.text().await.map_err(|e| {
                    (
                        StatusCode::BAD_REQUEST,
                        format!("Failed to read title: {}", e),
                    )
                })?;
                title = Some(text);
            }
            "gallery" => {
                let text: String = field.text().await.map_err(|e| {
                    (
                        StatusCode::BAD_REQUEST,
                        format!("Failed to read gallery: {}", e),
                    )
                })?;
                gallery = Some(text);
            }
            "origin" => {
                let text: String = field.text().await.map_err(|e| {
                    (
                        StatusCode::BAD_REQUEST,
                        format!("Failed to read origin: {}", e),
                    )
                })?;
                origin = Some(text);
            }
            "source" => {
                let text: String = field.text().await.map_err(|e| {
                    (
                        StatusCode::BAD_REQUEST,
                        format!("Failed to read source: {}", e),
                    )
                })?;
                source = Some(text);
            }
            "source_url" => {
                let text: String = field.text().await.map_err(|e| {
                    (
                        StatusCode::BAD_REQUEST,
                        format!("Failed to read source_url: {}", e),
                    )
                })?;
                source_url = Some(text);
            }
            "artist" => {
                let text: String = field.text().await.map_err(|e| {
                    (
                        StatusCode::BAD_REQUEST,
                        format!("Failed to read artist: {}", e),
                    )
                })?;
                artist = Some(text);
            }
            "medium" => {
                let text: String = field.text().await.map_err(|e| {
                    (
                        StatusCode::BAD_REQUEST,
                        format!("Failed to read medium: {}", e),
                    )
                })?;
                medium = Some(text);
            }
            "rating" => {
                let text: String = field.text().await.map_err(|e| {
                    (
                        StatusCode::BAD_REQUEST,
                        format!("Failed to read rating: {}", e),
                    )
                })?;
                rating = Some(text);
            }
            _ => {}
        }
    }

    // 验证必填字段
    let file_data =
        file_data.ok_or_else(|| (StatusCode::BAD_REQUEST, "File is required".to_string()))?;
    let title = normalize_required_text(title, "Title", MAX_TITLE_LEN)?;
    let gallery_kind = normalize_required_text(gallery, "Gallery", 16)?;
    let origin = normalize_optional_text(origin, "Origin", 32)?;
    let source = normalize_optional_text(source, "Source", MAX_SOURCE_LEN)?;
    let source_url = normalize_optional_text(source_url, "Source URL", MAX_SOURCE_URL_LEN)?;
    let artist = normalize_optional_text(artist, "Artist", MAX_ARTIST_LEN)?;
    let medium = normalize_optional_text(medium, "Medium", MAX_MEDIUM_LEN)?;
    let rating = normalize_optional_text(rating, "Rating", 32)?;

    // 验证 gallery 值
    if gallery_kind != "meme" && gallery_kind != "art" {
        return Err((
            StatusCode::BAD_REQUEST,
            "Gallery must be 'meme' or 'art'".to_string(),
        ));
    }

    if !source_url.is_empty() {
        validate_http_url(&source_url, "Source URL")?;
    }

    // meme 必须提供 origin
    if gallery_kind == "meme" {
        if origin.is_empty() {
            return Err((
                StatusCode::BAD_REQUEST,
                "Origin is required for meme gallery".to_string(),
            ));
        }
        if !["official", "derived", "fan_made"].contains(&origin.as_str()) {
            return Err((
                StatusCode::BAD_REQUEST,
                "Origin must be one of: official, derived, fan_made".to_string(),
            ));
        }
        if ["derived", "fan_made"].contains(&origin.as_str()) && source.is_empty() {
            return Err((
                StatusCode::BAD_REQUEST,
                "Source is required for derived or fan-made memes".to_string(),
            ));
        }
    }

    // art 不能有 origin
    if gallery_kind == "art" && !origin.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Origin must not be provided for art gallery".to_string(),
        ));
    }

    // art 必须提供 artist 和 rating
    if gallery_kind == "art" {
        if artist.is_empty() {
            return Err((
                StatusCode::BAD_REQUEST,
                "Artist is required for art gallery".to_string(),
            ));
        }
        if !["all_ages", "r15", "r18"].contains(&rating.as_str()) {
            return Err((
                StatusCode::BAD_REQUEST,
                "Rating must be one of: all_ages, r15, r18".to_string(),
            ));
        }
        if source_url.is_empty() {
            return Err((
                StatusCode::BAD_REQUEST,
                "Source URL is required for art gallery".to_string(),
            ));
        }
    }

    // 检测图片格式
    let content_type = detect_image_format(&file_data).map_err(|e| (StatusCode::BAD_REQUEST, e))?;
    validate_file_extension(file_name.as_deref(), &content_type)?;

    // 获取图片尺寸
    let (width, height) =
        get_image_dimensions(&file_data).map_err(|e| (StatusCode::BAD_REQUEST, e))?;

    // 防止解压缩炸弹攻击：限制图片尺寸
    const MAX_DIMENSION: u32 = 8192; // 8K 分辨率
    const MAX_PIXELS: u64 = 67_108_864; // 64MP (8192 * 8192)

    if width > MAX_DIMENSION || height > MAX_DIMENSION {
        return Err((
            StatusCode::BAD_REQUEST,
            format!(
                "Image dimensions exceed {}px limit ({}x{})",
                MAX_DIMENSION, width, height
            ),
        ));
    }

    let total_pixels = width as u64 * height as u64;
    if total_pixels > MAX_PIXELS {
        return Err((
            StatusCode::BAD_REQUEST,
            format!(
                "Image pixel count exceeds 64MP limit ({} pixels)",
                total_pixels
            ),
        ));
    }

    tracing::info!("Image dimensions: {}x{}", width, height);

    // Strip camera/metadata-bearing payloads for public originals (JPEG/PNG).
    let (public_file_data, public_content_type) = prepare_public_original(&file_data, &content_type)
        .map_err(|e| (StatusCode::BAD_REQUEST, e))?;
    let content_type = public_content_type.to_string();

    // 生成作品 ID 与独立的媒体 UUID（V3 S2：公开 URL 不暴露作品 ID）
    let work_id = Uuid::new_v4().to_string();
    let media_id = Uuid::new_v4();
    let file_ext = media::extension_for_mime(&content_type);
    let original_key = media::private_original_key(&media_id, file_ext);
    let thumbnail_key = media::private_thumb_key(&media_id);
    let bucket = storage::s3_bucket();
    let mut uploaded_keys: Vec<String> = Vec::new();

    // 上传原图到私有前缀（使用清理后的公开字节）
    if let Err(e) = storage::upload_object(
        &state.s3_client,
        &bucket,
        &original_key,
        public_file_data.clone(),
        &content_type,
    )
    .await
    {
        return Err((StatusCode::INTERNAL_SERVER_ERROR, e));
    }
    uploaded_keys.push(original_key.clone());

    // 生成缩略图（从已清理字节解码，避免写入 EXIF）
    let thumbnail_data = match generate_thumbnail(&public_file_data, THUMBNAIL_SIZE) {
        Ok(data) => data,
        Err(e) => {
            storage::delete_files_best_effort(&state.s3_client, &bucket, &uploaded_keys).await;
            return Err((StatusCode::INTERNAL_SERVER_ERROR, e));
        }
    };

    // 上传缩略图到私有前缀
    if let Err(e) = storage::upload_object(
        &state.s3_client,
        &bucket,
        &thumbnail_key,
        thumbnail_data,
        "image/jpeg",
    )
    .await
    {
        storage::delete_files_best_effort(&state.s3_client, &bucket, &uploaded_keys).await;
        return Err((StatusCode::INTERNAL_SERVER_ERROR, e));
    }
    uploaded_keys.push(thumbnail_key.clone());

    let original_sha256 = hex::encode(Sha256::digest(&public_file_data));

    // media_assets + works + art_meta 必须同事务；失败时补偿删除已写对象
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            storage::delete_files_best_effort(&state.s3_client, &bucket, &uploaded_keys).await;
            return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
        }
    };

    let content_rating = if gallery_kind == "art" {
        rating.as_str()
    } else {
        "all_ages"
    };

    if let Err(e) = sqlx::query(
        "INSERT INTO media_assets (id, owner_id, state, mime_type, original_key, thumb_key, original_sha256, width, height)
         VALUES ($1, $2, 'pending'::media_asset_state, $3, $4, $5, $6, $7, $8)",
    )
    .bind(media_id)
    .bind(user_id)
    .bind(&content_type)
    .bind(&original_key)
    .bind(&thumbnail_key)
    .bind(&original_sha256)
    .bind(width as i32)
    .bind(height as i32)
    .execute(&mut *tx)
    .await
    {
        let _ = tx.rollback().await;
        storage::delete_files_best_effort(&state.s3_client, &bucket, &uploaded_keys).await;
        return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
    }

    let query_str = r#"
        INSERT INTO works (id, gallery, content_kind, content_rating, origin, title, source, source_url, status, uploader_id, asset_file, thumbnail_asset_file, width, height, media_id)
        VALUES ($1, $2::gallery_kind, $3::content_kind, $4::content_rating, $5::meme_origin, $6, $7, $8, 'pending'::work_status, $9, $10, $11, $12, $13, $14)
        RETURNING id, title, status::text as status
    "#;

    let work = match sqlx::query(query_str)
        .bind(&work_id)
        .bind(&gallery_kind)
        .bind(&gallery_kind)
        .bind(content_rating)
        .bind(non_empty_str(&origin))
        .bind(&title)
        .bind(&source)
        .bind(&source_url)
        .bind(user_id)
        .bind(&original_key)
        .bind(&thumbnail_key)
        .bind(width as i32)
        .bind(height as i32)
        .bind(media_id)
        .fetch_one(&mut *tx)
        .await
    {
        Ok(row) => row,
        Err(e) => {
            let _ = tx.rollback().await;
            storage::delete_files_best_effort(&state.s3_client, &bucket, &uploaded_keys).await;
            return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
        }
    };

    if gallery_kind == "art" {
        if let Err(e) = sqlx::query(
            "INSERT INTO work_art_meta (work_id, artist, medium, rating) VALUES ($1, $2, $3, $4::art_rating)"
        )
        .bind(&work_id)
        .bind(&artist)
        .bind(non_empty_str(&medium))
        .bind(&rating)
        .execute(&mut *tx)
        .await
        {
            let _ = tx.rollback().await;
            storage::delete_files_best_effort(&state.s3_client, &bucket, &uploaded_keys).await;
            return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
        }
    }

    if let Err(e) = tx.commit().await {
        storage::delete_files_best_effort(&state.s3_client, &bucket, &uploaded_keys).await;
        return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
    }

    let work_id_ret: String = work
        .try_get("id")
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let work_title: String = work
        .try_get("title")
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let work_status: String = work
        .try_get("status")
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Pending 对象是私有的：上传响应返回短时效签名 URL 供上传者预览。
    let file_url = media::presign_get(&state.s3_client, &bucket, &original_key)
        .await
        .unwrap_or_default();
    let thumbnail_url = media::presign_get(&state.s3_client, &bucket, &thumbnail_key)
        .await
        .unwrap_or_default();

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "id": work_id_ret,
            "title": work_title,
            "status": work_status,
            "file_url": file_url,
            "thumbnail_url": thumbnail_url,
            "width": width,
            "height": height,
        })),
    ))
}

fn normalize_required_text(
    value: Option<String>,
    field_name: &str,
    max_len: usize,
) -> Result<String, (StatusCode, String)> {
    let value = normalize_optional_text(value, field_name, max_len)?;
    if value.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            format!("{} is required", field_name),
        ));
    }

    Ok(value)
}

fn normalize_optional_text(
    value: Option<String>,
    field_name: &str,
    max_len: usize,
) -> Result<String, (StatusCode, String)> {
    let value = value.unwrap_or_default().trim().to_string();
    if value.chars().count() > max_len {
        return Err((
            StatusCode::BAD_REQUEST,
            format!("{} must be {} characters or less", field_name, max_len),
        ));
    }

    Ok(value)
}

fn validate_http_url(value: &str, field_name: &str) -> Result<(), (StatusCode, String)> {
    let uri = value.parse::<Uri>().map_err(|_| {
        (
            StatusCode::BAD_REQUEST,
            format!("{} must be a valid URL", field_name),
        )
    })?;

    let scheme = uri.scheme_str();
    if !matches!(scheme, Some("http" | "https")) || uri.authority().is_none() {
        return Err((
            StatusCode::BAD_REQUEST,
            format!("{} must be an absolute HTTP(S) URL", field_name),
        ));
    }

    Ok(())
}

fn non_empty_str(value: &str) -> Option<&str> {
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn validate_file_extension(
    file_name: Option<&str>,
    content_type: &str,
) -> Result<(), (StatusCode, String)> {
    let Some(file_name) = file_name else {
        return Ok(());
    };
    let extension = file_name
        .rsplit_once('.')
        .map(|(_, extension)| extension.trim().to_ascii_lowercase())
        .filter(|extension| !extension.is_empty())
        .ok_or_else(|| {
            (
                StatusCode::BAD_REQUEST,
                "File extension is required for image uploads".to_string(),
            )
        })?;

    let allowed_extensions = match content_type {
        "image/png" => &["png"][..],
        "image/jpeg" => &["jpg", "jpeg"][..],
        "image/gif" => &["gif"][..],
        "image/webp" => &["webp"][..],
        _ => &[][..],
    };

    if allowed_extensions.contains(&extension.as_str()) {
        return Ok(());
    }

    Err((
        StatusCode::BAD_REQUEST,
        format!(
            "File extension .{} does not match detected image type {}",
            extension, content_type
        ),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_required_text_trims_and_rejects_blank() {
        assert_eq!(
            normalize_required_text(Some("  Lotus Art  ".to_string()), "Title", 200).unwrap(),
            "Lotus Art"
        );

        let error = normalize_required_text(Some("   ".to_string()), "Title", 200)
            .expect_err("blank required text should fail");
        assert_eq!(error.0, StatusCode::BAD_REQUEST);
        assert_eq!(error.1, "Title is required");
    }

    #[test]
    fn normalize_optional_text_enforces_character_limit() {
        let error = normalize_optional_text(Some("abcd".to_string()), "Medium", 3)
            .expect_err("overlong text should fail");

        assert_eq!(error.0, StatusCode::BAD_REQUEST);
        assert_eq!(error.1, "Medium must be 3 characters or less");
    }

    #[test]
    fn validate_http_url_requires_absolute_http_url() {
        assert!(validate_http_url("https://example.com/source", "Source URL").is_ok());
        assert!(validate_http_url("http://example.com/source", "Source URL").is_ok());

        let relative = validate_http_url("/relative/path", "Source URL")
            .expect_err("relative URL should fail");
        assert_eq!(relative.0, StatusCode::BAD_REQUEST);
        assert_eq!(
            relative.1,
            "Source URL must be an absolute HTTP(S) URL"
        );

        let javascript = validate_http_url("javascript:alert(1)", "Source URL")
            .expect_err("non-http URL should fail");
        assert_eq!(javascript.0, StatusCode::BAD_REQUEST);
    }

    #[test]
    fn validate_file_extension_matches_detected_image_type() {
        assert!(validate_file_extension(Some("lotus.PNG"), "image/png").is_ok());
        assert!(validate_file_extension(Some("scan.jpeg"), "image/jpeg").is_ok());
        assert!(validate_file_extension(Some("animation.gif"), "image/gif").is_ok());
        assert!(validate_file_extension(Some("upload"), "image/png").is_err());

        let error = validate_file_extension(Some("payload.exe"), "image/png")
            .expect_err("executable extension should fail");
        assert_eq!(error.0, StatusCode::BAD_REQUEST);
        assert_eq!(
            error.1,
            "File extension .exe does not match detected image type image/png"
        );
    }

    mod body_limit {
        use super::super::*;
        use crate::AppState;
        use aws_config::BehaviorVersion;
        use aws_sdk_s3::config::{Credentials, Region};
        use axum::body::{to_bytes, Body};
        use axum::extract::DefaultBodyLimit;
        use axum::http::{header, Request};
        use axum::routing::post;
        use axum::Router;
        use sqlx::postgres::PgPoolOptions;
        use tower::ServiceExt;

        const BOUNDARY: &str = "hasu-upload-test-boundary";

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

        async fn seed_session(session: Session) -> StatusCode {
            session
                .insert(SESSION_USER_ID_KEY, 1_i64)
                .await
                .expect("session insert should succeed");
            StatusCode::OK
        }

        // Mirrors the `/api/works/upload` registration in main.rs: the same
        // handler behind the same DefaultBodyLimit, with an in-memory session
        // store so the tests run without Postgres or MinIO.
        fn test_app() -> Router {
            Router::new()
                .route("/test/session", post(seed_session))
                .route(
                    "/api/works/upload",
                    post(upload_work).layer(DefaultBodyLimit::max(UPLOAD_BODY_LIMIT)),
                )
                .with_state(test_state())
                .layer(tower_sessions::SessionManagerLayer::new(
                    tower_sessions::MemoryStore::default(),
                ))
        }

        async fn authenticated_cookie(app: &Router) -> String {
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/test/session")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::OK);
            response
                .headers()
                .get(header::SET_COOKIE)
                .expect("session cookie should be set")
                .to_str()
                .unwrap()
                .split(';')
                .next()
                .unwrap()
                .to_string()
        }

        fn multipart_file_body(file_bytes: &[u8]) -> Vec<u8> {
            let mut body = Vec::new();
            body.extend_from_slice(
                format!(
                    "--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"file\"; \
                     filename=\"big.png\"\r\nContent-Type: image/png\r\n\r\n"
                )
                .as_bytes(),
            );
            body.extend_from_slice(file_bytes);
            body.extend_from_slice(format!("\r\n--{BOUNDARY}--\r\n").as_bytes());
            body
        }

        async fn upload_response(file_size: usize) -> (StatusCode, String) {
            let app = test_app();
            let cookie = authenticated_cookie(&app).await;
            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/works/upload")
                        .header(
                            header::CONTENT_TYPE,
                            format!("multipart/form-data; boundary={BOUNDARY}"),
                        )
                        .header(header::COOKIE, cookie)
                        .body(Body::from(multipart_file_body(&vec![0_u8; file_size])))
                        .unwrap(),
                )
                .await
                .unwrap();
            let status = response.status();
            let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
            (status, String::from_utf8_lossy(&body).into_owned())
        }

        // Regression: axum's default 2MB body limit used to reject uploads
        // between 2MB and 10MB before the handler ever saw them. A 3MB file
        // must now be read fully, so the request fails later on the missing
        // title instead of a body-read error.
        #[tokio::test]
        async fn reads_files_larger_than_axum_default_body_limit() {
            let (status, body) = upload_response(3 * 1024 * 1024).await;

            assert_eq!(status, StatusCode::BAD_REQUEST);
            assert_eq!(body, "Title is required");
        }

        // The handler's own 10MB check must stay reachable: a file just over
        // MAX_FILE_SIZE fits inside UPLOAD_BODY_LIMIT and gets the product
        // 413, not a transport-level rejection.
        #[tokio::test]
        async fn rejects_file_exceeding_max_file_size_with_413() {
            let (status, body) = upload_response(MAX_FILE_SIZE + 1).await;

            assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
            assert_eq!(body, "File size exceeds 10MB limit");
        }
    }
}
