use aws_config::BehaviorVersion;
use aws_sdk_s3::{
    config::{Credentials, Region},
    Client,
};
use std::env;

const DEFAULT_PUBLIC_MEDIA_BASE_URL: &str = "https://cdn.example.com/hasu-gallery";

/// 创建 S3 客户端
pub async fn create_s3_client() -> Client {
    let endpoint = env::var("S3_ENDPOINT").unwrap_or_else(|_| "http://localhost:9000".to_string());
    let region = env::var("S3_REGION").unwrap_or_else(|_| "us-east-1".to_string());
    let access_key = env::var("S3_ACCESS_KEY").unwrap_or_else(|_| "minioadmin".to_string());
    let secret_key = env::var("S3_SECRET_KEY").unwrap_or_else(|_| "minioadmin".to_string());

    let credentials = Credentials::new(access_key, secret_key, None, None, "hasu-gallery");

    let config = aws_config::defaults(BehaviorVersion::latest())
        .region(Region::new(region))
        .credentials_provider(credentials)
        .endpoint_url(endpoint)
        .load()
        .await;

    Client::new(&config)
}

/// 上传文件到 S3
pub async fn upload_file(
    client: &Client,
    bucket: &str,
    key: &str,
    body: Vec<u8>,
    content_type: &str,
) -> Result<String, String> {
    client
        .put_object()
        .bucket(bucket)
        .key(key)
        .body(body.into())
        .content_type(content_type)
        .send()
        .await
        .map_err(|e| format!("Failed to upload to S3: {}", e))?;

    Ok(format!("{}/{}", public_media_base_url(), key))
}

/// Best-effort object deletion used for upload compensation and takedown.
pub async fn delete_file(client: &Client, bucket: &str, key: &str) -> Result<(), String> {
    client
        .delete_object()
        .bucket(bucket)
        .key(key)
        .send()
        .await
        .map_err(|e| format!("Failed to delete S3 object {}: {}", key, e))?;
    Ok(())
}

/// Delete every key, logging failures without aborting the rest.
pub async fn delete_files_best_effort(client: &Client, bucket: &str, keys: &[String]) {
    for key in keys {
        if let Err(error) = delete_file(client, bucket, key).await {
            tracing::warn!(key = %key, error = %error, "failed to delete uploaded object");
        }
    }
}

/// Extract object key from a stored public media URL when possible.
pub fn object_key_from_public_url(url: &str) -> Option<String> {
    let base = public_media_base_url();
    let prefix = format!("{}/", base);
    url.strip_prefix(&prefix)
        .map(str::trim)
        .filter(|key| !key.is_empty())
        .map(ToString::to_string)
}

pub fn public_media_base_url() -> String {
    env::var("PUBLIC_MEDIA_BASE_URL")
        .unwrap_or_else(|_| DEFAULT_PUBLIC_MEDIA_BASE_URL.to_string())
        .trim_end_matches('/')
        .to_string()
}

pub fn s3_bucket() -> String {
    env::var("S3_BUCKET").unwrap_or_else(|_| "hasu-gallery".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, OnceLock};

    static ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    fn env_lock() -> std::sync::MutexGuard<'static, ()> {
        ENV_LOCK.get_or_init(|| Mutex::new(())).lock().unwrap()
    }

    #[test]
    fn public_media_base_url_uses_cdn_default() {
        let _guard = env_lock();
        env::remove_var("PUBLIC_MEDIA_BASE_URL");

        assert_eq!(public_media_base_url(), DEFAULT_PUBLIC_MEDIA_BASE_URL);
    }

    #[test]
    fn public_media_base_url_trims_trailing_slash() {
        let _guard = env_lock();
        env::set_var("PUBLIC_MEDIA_BASE_URL", "https://cdn.example/hasu/");

        assert_eq!(public_media_base_url(), "https://cdn.example/hasu");
        env::remove_var("PUBLIC_MEDIA_BASE_URL");
    }

    #[test]
    fn object_key_from_public_url_strips_configured_base() {
        let _guard = env_lock();
        env::set_var("PUBLIC_MEDIA_BASE_URL", "https://cdn.example/hasu");

        assert_eq!(
            object_key_from_public_url("https://cdn.example/hasu/abc.jpg").as_deref(),
            Some("abc.jpg")
        );
        assert_eq!(
            object_key_from_public_url("https://other.example/hasu/abc.jpg"),
            None
        );
        env::remove_var("PUBLIC_MEDIA_BASE_URL");
    }
}
