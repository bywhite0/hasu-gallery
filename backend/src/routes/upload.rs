use axum::{extract::State, http::{StatusCode, Uri}, response::IntoResponse, Json};
use axum_extra::extract::Multipart;
use serde_json::json;
use sqlx::Row;
use tower_sessions::Session;
use uuid::Uuid;

use crate::{
    image_processor::{detect_image_format, generate_thumbnail, get_image_dimensions},
    storage, AppState,
};

const SESSION_USER_ID_KEY: &str = "user_id";
const MAX_FILE_SIZE: usize = 10 * 1024 * 1024; // 10MB
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

    // 生成唯一 ID 和文件名
    let work_id = Uuid::new_v4().to_string();
    let file_ext = match content_type.as_str() {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/gif" => "gif",
        "image/webp" => "webp",
        _ => "jpg",
    };
    let file_key = format!("{}.{}", work_id, file_ext);

    // 上传原图到 S3
    let bucket = std::env::var("S3_BUCKET").unwrap_or_else(|_| "hasu-gallery".to_string());
    let file_url = storage::upload_file(
        &state.s3_client,
        &bucket,
        &file_key,
        file_data.clone(),
        &content_type,
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    // 生成缩略图
    let thumbnail_data = generate_thumbnail(&file_data, THUMBNAIL_SIZE)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    // 上传缩略图到 S3
    let thumbnail_key = format!("{}_thumb.jpg", work_id);
    let thumbnail_url = storage::upload_file(
        &state.s3_client,
        &bucket,
        &thumbnail_key,
        thumbnail_data,
        "image/jpeg",
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    // 插入数据库记录（使用参数化查询防止 SQL 注入）
    let query_str = r#"
        INSERT INTO works (id, gallery, origin, title, source, source_url, status, uploader_id, asset_file, thumbnail_asset_file, width, height)
        VALUES ($1, $2::gallery_kind, $3::meme_origin, $4, $5, $6, 'pending'::work_status, $7, $8, $9, $10, $11)
        RETURNING id, title, status::text as status
    "#;

    let work = sqlx::query(query_str)
        .bind(&work_id)
        .bind(&gallery_kind)
        .bind(non_empty_str(&origin)) // None 会自动转换为 NULL
        .bind(&title)
        .bind(&source)
        .bind(&source_url)
        .bind(user_id)
        .bind(&file_url)
        .bind(&thumbnail_url)
        .bind(width as i32)
        .bind(height as i32)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 插入 art 元数据
    if gallery_kind == "art" {
        sqlx::query(
            "INSERT INTO work_art_meta (work_id, artist, medium, rating) VALUES ($1, $2, $3, $4::art_rating)"
        )
        .bind(&work_id)
        .bind(&artist)
        .bind(non_empty_str(&medium))
        .bind(&rating)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
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
}
