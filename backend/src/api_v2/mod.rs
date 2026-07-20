pub mod codec;
pub mod fiction;
pub mod health;
pub mod public_works;
pub mod spa;

use axum::{Router, routing::get};

use crate::AppState;

pub fn router(fiction_command_limiter: crate::middleware::RateLimiter) -> Router<AppState> {
    Router::new()
        .route("/api/v2/public/health", get(health::public_health))
        .merge(public_works::public_works_routes())
        .merge(fiction::fiction_routes(fiction_command_limiter))
}
