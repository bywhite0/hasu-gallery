// Architecture V3 S2: media identity and URL derivation.
//
// Every uploaded image gets a UUIDv4 media ID distinct from its work ID.
// Originals and thumbnails live under private/{media_id}/...; approval copies
// them to public/{media_id}/v{n}/... which is the only CDN-served namespace.
// Works without a media row fall back to the legacy {work_id}.{ext} keys.

use aws_sdk_s3::presigning::PresigningConfig;
use sqlx::Row;
use std::time::Duration;
use uuid::Uuid;

use crate::storage::{public_media_base_url, s3_bucket};

/// Short-lived signed access for owner/moderator review of private objects.
pub const PRESIGNED_REVIEW_EXPIRY: Duration = Duration::from_secs(300);

pub fn extension_for_mime(mime: &str) -> &'static str {
    match mime {
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        _ => "jpg",
    }
}

pub fn mime_for_extension(ext: &str) -> &'static str {
    match ext {
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "image/jpeg",
    }
}

pub fn private_original_key(media_id: &Uuid, ext: &str) -> String {
    format!("private/{}/original.{}", media_id, ext)
}

pub fn private_thumb_key(media_id: &Uuid) -> String {
    format!("private/{}/thumb.jpg", media_id)
}

pub fn public_original_key(media_id: &Uuid, version: i32, ext: &str) -> String {
    format!("public/{}/v{}/image.{}", media_id, version, ext)
}

pub fn public_thumb_key(media_id: &Uuid, version: i32) -> String {
    format!("public/{}/v{}/thumb.jpg", media_id, version)
}

pub fn public_original_url(media_id: &Uuid, version: i32, ext: &str) -> String {
    format!(
        "{}/{}",
        public_media_base_url(),
        public_original_key(media_id, version, ext)
    )
}

pub fn public_thumb_url(media_id: &Uuid, version: i32) -> String {
    format!(
        "{}/{}",
        public_media_base_url(),
        public_thumb_key(media_id, version)
    )
}

/// Legacy pre-S2 public URL: {base}/{work_id}.{ext} derived from asset_file.
pub fn legacy_file_url(work_id: &str, asset_file: &str) -> String {
    let ext = asset_file.rsplit('.').next().unwrap_or("jpg");
    format!("{}/{}.{}", public_media_base_url(), work_id, ext)
}

/// Legacy pre-S2 thumbnail URL (thumbnails are always JPEG).
pub fn legacy_thumbnail_url(work_id: &str) -> String {
    format!("{}/{}_thumb.jpg", public_media_base_url(), work_id)
}

/// Media columns selected alongside a work row (all optional for legacy rows).
#[derive(Debug, Default, Clone)]
pub struct MediaRef {
    pub id: Option<Uuid>,
    pub state: Option<String>,
    pub public_version: i32,
    pub mime_type: Option<String>,
}

/// Read `media_id`, `media_state`, `media_public_version`, `media_mime_type`
/// columns from a joined work row.
pub fn media_ref_from_row(row: &sqlx::postgres::PgRow) -> MediaRef {
    MediaRef {
        id: row.try_get::<Option<Uuid>, _>("media_id").ok().flatten(),
        state: row
            .try_get::<Option<String>, _>("media_state")
            .ok()
            .flatten(),
        public_version: row
            .try_get::<Option<i32>, _>("media_public_version")
            .ok()
            .flatten()
            .unwrap_or(1),
        mime_type: row
            .try_get::<Option<String>, _>("media_mime_type")
            .ok()
            .flatten(),
    }
}

pub struct WorkMediaUrls {
    pub file_url: String,
    pub thumbnail_url: String,
}

/// Derive the file/thumbnail URLs for a work.
///
/// `allow_private` must only be true when the caller has already authorized
/// owner/moderator access; it switches non-public media to short-lived
/// presigned GET URLs instead of exposing private keys publicly.
pub async fn resolve_work_media_urls(
    s3: &aws_sdk_s3::Client,
    work_id: &str,
    legacy_asset_file: &str,
    media: &MediaRef,
    allow_private: bool,
) -> WorkMediaUrls {
    let Some(media_id) = media.id else {
        return WorkMediaUrls {
            file_url: legacy_file_url(work_id, legacy_asset_file),
            thumbnail_url: legacy_thumbnail_url(work_id),
        };
    };

    let ext = extension_for_mime(media.mime_type.as_deref().unwrap_or(""));
    let version = media.public_version.max(1);

    match media.state.as_deref() {
        Some("public") => WorkMediaUrls {
            file_url: public_original_url(&media_id, version, ext),
            thumbnail_url: public_thumb_url(&media_id, version),
        },
        // Takedown retains originals for the legal window, but the platform
        // must stop distributing them: no presigned URLs, not even for the
        // uploader.
        Some("removed") => WorkMediaUrls {
            file_url: String::new(),
            thumbnail_url: String::new(),
        },
        _ if allow_private => {
            let bucket = s3_bucket();
            WorkMediaUrls {
                file_url: presign_get(s3, &bucket, &private_original_key(&media_id, ext))
                    .await
                    .unwrap_or_default(),
                thumbnail_url: presign_get(s3, &bucket, &private_thumb_key(&media_id))
                    .await
                    .unwrap_or_default(),
            }
        }
        _ => WorkMediaUrls {
            file_url: String::new(),
            thumbnail_url: String::new(),
        },
    }
}

/// Sign a short-lived GET for a private object (local HMAC, no network I/O).
pub async fn presign_get(
    s3: &aws_sdk_s3::Client,
    bucket: &str,
    key: &str,
) -> Result<String, String> {
    let config = PresigningConfig::expires_in(PRESIGNED_REVIEW_EXPIRY)
        .map_err(|e| format!("presign config: {}", e))?;
    let request = s3
        .get_object()
        .bucket(bucket)
        .key(key)
        .presigned(config)
        .await
        .map_err(|e| format!("presign {}: {}", key, e))?;
    Ok(request.uri().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use aws_config::BehaviorVersion;
    use aws_sdk_s3::config::{Credentials, Region};

    fn test_client() -> aws_sdk_s3::Client {
        let config = aws_sdk_s3::Config::builder()
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
        aws_sdk_s3::Client::from_conf(config)
    }

    #[test]
    fn keys_use_private_and_public_prefixes() {
        let id = Uuid::nil();
        assert_eq!(
            private_original_key(&id, "png"),
            format!("private/{}/original.png", id)
        );
        assert_eq!(private_thumb_key(&id), format!("private/{}/thumb.jpg", id));
        assert_eq!(
            public_original_key(&id, 1, "webp"),
            format!("public/{}/v1/image.webp", id)
        );
        assert_eq!(
            public_thumb_key(&id, 2),
            format!("public/{}/v2/thumb.jpg", id)
        );
    }

    #[test]
    fn mime_and_extension_round_trip() {
        assert_eq!(extension_for_mime("image/png"), "png");
        assert_eq!(extension_for_mime("image/jpeg"), "jpg");
        assert_eq!(extension_for_mime("unknown"), "jpg");
        assert_eq!(mime_for_extension("webp"), "image/webp");
        assert_eq!(mime_for_extension("jpeg"), "image/jpeg");
    }

    #[tokio::test]
    async fn resolve_falls_back_to_legacy_urls_without_media() {
        let urls = resolve_work_media_urls(
            &test_client(),
            "work-1",
            "https://cdn.example/hasu/work-1.png",
            &MediaRef::default(),
            false,
        )
        .await;

        assert!(urls.file_url.ends_with("/work-1.png"));
        assert!(urls.thumbnail_url.ends_with("/work-1_thumb.jpg"));
    }

    #[tokio::test]
    async fn resolve_public_media_uses_uuid_urls() {
        let id = Uuid::new_v4();
        let media = MediaRef {
            id: Some(id),
            state: Some("public".to_string()),
            public_version: 1,
            mime_type: Some("image/png".to_string()),
        };
        let urls =
            resolve_work_media_urls(&test_client(), "work-1", "ignored.png", &media, false).await;

        assert!(urls.file_url.ends_with(&format!("/public/{}/v1/image.png", id)));
        assert!(urls
            .thumbnail_url
            .ends_with(&format!("/public/{}/v1/thumb.jpg", id)));
        assert!(!urls.file_url.contains("work-1"));
    }

    #[tokio::test]
    async fn resolve_pending_media_hides_urls_from_public_context() {
        let media = MediaRef {
            id: Some(Uuid::new_v4()),
            state: Some("pending".to_string()),
            public_version: 1,
            mime_type: Some("image/png".to_string()),
        };
        let urls =
            resolve_work_media_urls(&test_client(), "work-1", "ignored.png", &media, false).await;

        assert!(urls.file_url.is_empty());
        assert!(urls.thumbnail_url.is_empty());
    }

    #[tokio::test]
    async fn resolve_pending_media_presigns_for_authorized_context() {
        let id = Uuid::new_v4();
        let media = MediaRef {
            id: Some(id),
            state: Some("pending".to_string()),
            public_version: 1,
            mime_type: Some("image/png".to_string()),
        };
        let urls =
            resolve_work_media_urls(&test_client(), "work-1", "ignored.png", &media, true).await;

        assert!(urls.file_url.contains(&format!("private/{}/original.png", id)));
        assert!(urls.file_url.contains("X-Amz-Signature="));
        assert!(urls.thumbnail_url.contains(&format!("private/{}/thumb.jpg", id)));
        assert!(urls.thumbnail_url.contains("X-Amz-Expires=300"));
    }
}
