use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use axum_extra::extract::Multipart;
use serde_json::json;
use sqlx::Row;
use tower_sessions::Session;
use uuid::Uuid;

use crate::{
    image_processor::{detect_image_format, generate_thumbnail, get_image_dimensions},
    storage,
    AppState,
};

const SESSION_USER_ID_KEY: &str = "user_id";
const MAX_FILE_SIZE: usize = 10 * 1024 * 1024; // 10MB
const THUMBNAIL_SIZE: u32 = 400;

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
    let mut title: Option<String> = None;
    let mut gallery: Option<String> = None;

    // 解析 multipart 数据
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Failed to read field: {}", e)))?
    {
        let name = field.name().unwrap_or("").to_string();

        match name.as_str() {
            "file" => {
                let data = field
                    .bytes()
                    .await
                    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Failed to read file: {}", e)))?
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
                let text: String = field
                    .text()
                    .await
                    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Failed to read title: {}", e)))?;
                title = Some(text);
            }
            "gallery" => {
                let text: String = field
                    .text()
                    .await
                    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Failed to read gallery: {}", e)))?;
                gallery = Some(text);
            }
            _ => {}
        }
    }

    // 验证必填字段
    let file_data = file_data.ok_or_else(|| (StatusCode::BAD_REQUEST, "File is required".to_string()))?;
    let title = title.ok_or_else(|| (StatusCode::BAD_REQUEST, "Title is required".to_string()))?;
    let gallery_kind = gallery.ok_or_else(|| (StatusCode::BAD_REQUEST, "Gallery is required".to_string()))?;

    // 验证 gallery 值
    if gallery_kind != "meme" && gallery_kind != "art" {
        return Err((
            StatusCode::BAD_REQUEST,
            "Gallery must be 'meme' or 'art'".to_string(),
        ));
    }

    // 检测图片格式
    let content_type = detect_image_format(&file_data)
        .map_err(|e| (StatusCode::BAD_REQUEST, e))?;

    // 获取图片尺寸
    let (width, height) = get_image_dimensions(&file_data)
        .map_err(|e| (StatusCode::BAD_REQUEST, e))?;

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

    // 插入数据库记录
    let query_str = format!(
        r#"
        INSERT INTO works (id, gallery, title, status, uploader_id, asset_file, thumbnail_asset_file, width, height)
        VALUES ($1, '{}'::gallery_kind, $2, 'pending'::work_status, $3, $4, $5, $6, $7)
        RETURNING id, title, status::text as status
        "#,
        gallery_kind
    );

    let work = sqlx::query(&query_str)
        .bind(&work_id)
        .bind(&title)
        .bind(user_id)
        .bind(&file_url)
        .bind(&thumbnail_url)
        .bind(width as i32)
        .bind(height as i32)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let work_id_ret: String = work.try_get("id")
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let work_title: String = work.try_get("title")
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let work_status: String = work.try_get("status")
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
