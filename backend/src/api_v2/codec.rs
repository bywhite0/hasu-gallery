use axum::{
    body::Body,
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::Response,
};
use prost::Message;
use sha2::{Digest, Sha256};

use crate::proto::hasu::gallery::v2::{ErrorResponse, FieldViolation};

/// V2 business API media type from Architecture V2 §7.1.
pub const PROTO_MEDIA_TYPE: &str = "application/vnd.hasu-gallery.v2+protobuf";

pub fn protobuf_response<T: Message>(status: StatusCode, message: &T) -> Response {
    let mut body = Vec::with_capacity(message.encoded_len());
    message
        .encode(&mut body)
        .expect("protobuf encode into Vec should not fail");

    let mut response = Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, PROTO_MEDIA_TYPE)
        .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
        .header(header::CACHE_CONTROL, "no-store")
        .body(Body::from(body))
        .expect("protobuf response should build");

    // Ensure Content-Type remains exact even if intermediaries normalize.
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static(PROTO_MEDIA_TYPE),
    );
    response
}

/// Public micro-cache Protobuf response with a strong ETag derived from the
/// encoded body (Architecture V2 §12.2). Encodes once and reuses the bytes so
/// the ETag and the response body are guaranteed consistent.
pub fn public_protobuf_response<T: Message>(message: &T) -> Response {
    let mut body = Vec::with_capacity(message.encoded_len());
    message
        .encode(&mut body)
        .expect("protobuf encode into Vec should not fail");
    let etag = format!("\"{}\"", hex::encode(Sha256::digest(&body)));

    let mut response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, PROTO_MEDIA_TYPE)
        .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
        .header(
            header::CACHE_CONTROL,
            "public, max-age=60, stale-while-revalidate=120",
        )
        .body(Body::from(body))
        .expect("protobuf response should build");
    if let Ok(value) = HeaderValue::from_str(&etag) {
        response.headers_mut().insert(header::ETAG, value);
    }
    response
}

pub fn error_response(
    status: StatusCode,
    code: &str,
    message_key: &str,
    message: &str,
    request_id: &str,
    field_violations: Vec<FieldViolation>,
) -> Response {
    let body = ErrorResponse {
        code: code.to_string(),
        message_key: message_key.to_string(),
        message: message.to_string(),
        request_id: request_id.to_string(),
        field_violations,
    };
    protobuf_response(status, &body)
}

/// Build a 415 Protobuf error for command routes that require a body.
pub fn unsupported_media_type(request_id: &str) -> Response {
    error_response(
        StatusCode::UNSUPPORTED_MEDIA_TYPE,
        "unsupported_media_type",
        "error.unsupported_media_type",
        "Request Content-Type must be application/vnd.hasu-gallery.v2+protobuf",
        request_id,
        Vec::new(),
    )
}

pub fn not_acceptable(request_id: &str) -> Response {
    error_response(
        StatusCode::NOT_ACCEPTABLE,
        "not_acceptable",
        "error.not_acceptable",
        "Response Accept must allow application/vnd.hasu-gallery.v2+protobuf",
        request_id,
        Vec::new(),
    )
}

/// Returns true when Accept is empty, `*/*`, or explicitly allows the V2 protobuf media type.
pub fn accepts_protobuf(headers: &HeaderMap) -> bool {
    let Some(value) = headers.get(header::ACCEPT).and_then(|v| v.to_str().ok()) else {
        return true;
    };

    let value = value.trim();
    if value.is_empty() || value == "*/*" {
        return true;
    }

    value
        .split(',')
        .map(str::trim)
        .any(|part| {
            let media = part.split(';').next().unwrap_or(part).trim();
            media.eq_ignore_ascii_case(PROTO_MEDIA_TYPE)
                || media.eq_ignore_ascii_case("application/*")
                || media == "*/*"
        })
}

/// True when Content-Type is exactly the V2 protobuf media type (parameters ignored).
pub fn content_type_is_protobuf(headers: &HeaderMap) -> bool {
    headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|value| {
            let media = value.split(';').next().unwrap_or(value).trim();
            media.eq_ignore_ascii_case(PROTO_MEDIA_TYPE)
        })
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::proto::hasu::gallery::v2::HealthResponse;
    use axum::body::to_bytes;

    #[tokio::test]
    async fn encodes_health_response_with_v2_media_type() {
        let response = protobuf_response(
            StatusCode::OK,
            &HealthResponse {
                status: "ok".into(),
                version: "0.1.0".into(),
                api: "v2".into(),
            },
        );

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response
                .headers()
                .get(header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok()),
            Some(PROTO_MEDIA_TYPE)
        );
        assert_eq!(
            response
                .headers()
                .get(header::X_CONTENT_TYPE_OPTIONS)
                .and_then(|v| v.to_str().ok()),
            Some("nosniff")
        );

        let bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body");
        let decoded = HealthResponse::decode(bytes.as_ref()).expect("decode");
        assert_eq!(decoded.status, "ok");
        assert_eq!(decoded.api, "v2");
    }

    #[test]
    fn accept_header_allows_default_and_explicit_protobuf() {
        let mut headers = HeaderMap::new();
        assert!(accepts_protobuf(&headers));

        headers.insert(header::ACCEPT, HeaderValue::from_static("*/*"));
        assert!(accepts_protobuf(&headers));

        headers.insert(
            header::ACCEPT,
            HeaderValue::from_static(PROTO_MEDIA_TYPE),
        );
        assert!(accepts_protobuf(&headers));

        headers.insert(header::ACCEPT, HeaderValue::from_static("application/json"));
        assert!(!accepts_protobuf(&headers));
    }

    #[test]
    fn public_protobuf_response_sets_strong_etag_and_public_cache() {
        let response = public_protobuf_response(&HealthResponse {
            status: "ok".into(),
            version: "0.1.0".into(),
            api: "v2".into(),
        });

        assert_eq!(response.status(), StatusCode::OK);
        let etag = response
            .headers()
            .get(header::ETAG)
            .and_then(|v| v.to_str().ok())
            .expect("etag header");
        // Strong ETag: quoted 64-char hex sha256.
        assert!(etag.starts_with('"') && etag.ends_with('"'));
        assert_eq!(etag.len(), 66);
        let cache = response
            .headers()
            .get(header::CACHE_CONTROL)
            .and_then(|v| v.to_str().ok())
            .expect("cache-control header");
        assert!(cache.contains("public") && cache.contains("max-age=60"));
    }
}
