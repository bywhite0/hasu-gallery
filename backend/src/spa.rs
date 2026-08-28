use axum::{
    body::Body,
    http::{StatusCode, Uri, header},
    response::{IntoResponse, Response},
};
use rust_embed::Embed;

#[derive(Embed)]
#[folder = "embedded-web/"]
struct EmbeddedWeb;

/// Serve embedded Rspack assets. API routes must be registered before the fallback.
pub async fn serve_embedded(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    let asset_path = if path.is_empty() { "index.html" } else { path };

    if let Some(file) = EmbeddedWeb::get(asset_path) {
        return asset_response(asset_path, file.data.as_ref());
    }

    // SPA history fallback for client routes.
    if let Some(index) = EmbeddedWeb::get("index.html") {
        return html_response(index.data.as_ref(), true);
    }

    (StatusCode::NOT_FOUND, "SPA asset missing").into_response()
}

fn asset_response(path: &str, bytes: &[u8]) -> Response {
    if path == "index.html" {
        return html_response(bytes, true);
    }

    let mime = mime_guess::from_path(path)
        .first_or_octet_stream()
        .essence_str()
        .to_string();

    let cache_control = if is_content_hashed(path) {
        "public, max-age=31536000, immutable"
    } else {
        "public, max-age=300"
    };

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime)
        .header(header::CACHE_CONTROL, cache_control)
        .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
        .body(Body::from(bytes.to_vec()))
        .expect("static asset response should build")
}

fn html_response(bytes: &[u8], no_cache: bool) -> Response {
    let cache = if no_cache {
        "no-cache"
    } else {
        "public, max-age=300"
    };

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
        .header(header::CACHE_CONTROL, cache)
        .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
        .body(Body::from(bytes.to_vec()))
        .expect("html response should build")
}

fn is_content_hashed(path: &str) -> bool {
    let file_name = path.rsplit('/').next().unwrap_or(path);
    // Rspack content-hashed assets typically look like main.abc123.js
    let stem = file_name.split('.').collect::<Vec<_>>();
    stem.len() >= 3
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;

    #[tokio::test]
    async fn spa_fallback_serves_index_html() {
        let response = serve_embedded("/gallery/meme".parse().expect("uri")).await;
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response
                .headers()
                .get(header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok()),
            Some("text/html; charset=utf-8")
        );
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body");
        let text = String::from_utf8(body.to_vec()).expect("utf8");
        assert!(text.contains("Hasu Gallery") || text.contains("root") || text.contains("html"));
    }
}
