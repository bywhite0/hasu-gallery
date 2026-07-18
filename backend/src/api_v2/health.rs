use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
};

use crate::AppState;
use crate::proto::hasu::gallery::v2::HealthResponse;

use super::codec::{accepts_protobuf, not_acceptable, protobuf_response};

const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Public V2 liveness probe. Does not inspect cookies or touch the database so
/// public CDN/micro-cache policy remains safe for later slices.
pub async fn public_health(
    State(_state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if !accepts_protobuf(&headers) {
        return not_acceptable("public-health");
    }

    protobuf_response(
        StatusCode::OK,
        &HealthResponse {
            status: "ok".to_string(),
            version: APP_VERSION.to_string(),
            api: "v2".to_string(),
        },
    )
}
