use axum::{
    Router,
    routing::{get, post, patch},
    response::IntoResponse,
    http::StatusCode,
    extract::State,
    middleware::from_fn_with_state,
};
use std::net::SocketAddr;
use std::time::Duration;
use tower_http::cors::CorsLayer;
use tower_sessions::{SessionManagerLayer, Expiry};
use tower_sessions_sqlx_store::PostgresStore;

mod db;
mod auth;
mod models;
mod routes;
mod storage;
mod image_processor;
mod middleware;

#[derive(Clone)]
struct AppState {
    db: db::DbPool,
    s3_client: aws_sdk_s3::Client,
}

#[tokio::main]
async fn main() {
    // Load environment variables. `pnpm dev:api` runs from the repo root,
    // while direct cargo runs usually run from `backend/`.
    dotenv::dotenv().ok();
    dotenv::from_filename("backend/.env").ok();

    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Get database URL
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://hasu_user:hasu_pass@localhost:5432/hasu_gallery".to_string());

    // Create database connection pool
    tracing::info!("Connecting to database...");
    let db = db::create_pool(&database_url)
        .await
        .expect("Failed to create database pool");

    // Run migrations
    tracing::info!("Running migrations...");
    db::run_migrations(&db)
        .await
        .expect("Failed to run migrations");
    tracing::info!("Migrations completed");

    // Create session store
    let session_store = PostgresStore::new(db.clone());
    session_store
        .migrate()
        .await
        .expect("Failed to migrate session store");

    let session_layer = SessionManagerLayer::new(session_store)
        .with_expiry(Expiry::OnInactivity(time::Duration::days(7)));

    // Create S3 client
    tracing::info!("Initializing S3 client...");
    let s3_client = storage::create_s3_client().await;

    // Create shared state
    let state = AppState { db, s3_client };
    let login_rate_limiter = middleware::RateLimiter::new(10, Duration::from_secs(60));
    let upload_rate_limiter = middleware::RateLimiter::new(20, Duration::from_secs(60 * 60));

    // 从环境变量读取 CORS 配置
    let allowed_origins_str = std::env::var("CORS_ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:5173,http://127.0.0.1:5173".to_string());

    let allowed_origins: Vec<_> = allowed_origins_str
        .split(',')
        .filter_map(|s| s.trim().parse().ok())
        .collect();

    tracing::info!("CORS allowed origins: {:?}", allowed_origins);

    // Build router
    // Moderation routes (require moderator/admin role) - use PgPool as state
    let moderation_routes = Router::new()
        .route("/api/moderation/queue", get(routes::moderation::get_queue))
        .route("/api/works/:id/status", patch(routes::moderation::update_status))
        .route("/api/moderation/log/:work_id", get(routes::moderation::get_log))
        .with_state(state.db.clone())
        .layer(from_fn_with_state(
            state.db.clone(),
            middleware::require_moderator
        ));

    // Public routes - use AppState
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/auth/register", post(routes::auth::register))
        .route(
            "/api/auth/login",
            post(routes::auth::login).route_layer(from_fn_with_state(
                login_rate_limiter,
                middleware::rate_limit,
            )),
        )
        .route("/api/auth/logout", post(routes::auth::logout))
        .route("/api/auth/me", get(routes::auth::me))
        .route("/api/works", get(routes::works::handle_works_list))
        .route("/api/works/facets", get(routes::works::handle_work_facets))
        .route("/api/works/:id", get(routes::works::handle_work_detail))
        .route(
            "/api/works/upload",
            post(routes::upload::upload_work).route_layer(from_fn_with_state(
                upload_rate_limiter,
                middleware::rate_limit,
            )),
        )
        .route("/api/users/me/works", get(routes::users::handle_my_works))
        .route("/api/users/me/stats", get(routes::users::handle_my_stats))
        .merge(moderation_routes)
        .with_state(state)
        .layer(session_layer)
        .layer(
            CorsLayer::new()
                .allow_origin(allowed_origins)
                .allow_methods([
                    axum::http::Method::GET,
                    axum::http::Method::POST,
                    axum::http::Method::PUT,
                    axum::http::Method::PATCH,
                    axum::http::Method::DELETE,
                    axum::http::Method::OPTIONS,
                ])
                .allow_headers([
                    axum::http::header::CONTENT_TYPE,
                    axum::http::header::AUTHORIZATION,
                ])
                .allow_credentials(true),
        );

    // Start server
    let addr = SocketAddr::from(([127, 0, 0, 1], 8787));
    tracing::info!("hasu-gallery API listening at http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check(State(state): State<AppState>) -> impl IntoResponse {
    // Test database connection
    match sqlx::query("SELECT 1")
        .fetch_one(&state.db)
        .await
    {
        Ok(_) => (StatusCode::OK, "OK"),
        Err(e) => {
            tracing::error!("Database health check failed: {}", e);
            (StatusCode::SERVICE_UNAVAILABLE, "Database unavailable")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use aws_config::BehaviorVersion;
    use aws_sdk_s3::config::{Credentials, Region};
    use axum::{
        body::{to_bytes, Body},
        http::Request,
        routing::get,
    };
    use sqlx::postgres::PgPoolOptions;
    use tower::ServiceExt;
    use tower_sessions::{MemoryStore, SessionManagerLayer};

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

    async fn request_work_facets(path: &str) -> (StatusCode, String) {
        let app = Router::new()
            .route("/api/works/facets", get(routes::works::handle_work_facets))
            .with_state(test_state())
            .layer(SessionManagerLayer::new(MemoryStore::default()));

        let response = app
            .oneshot(
                Request::builder()
                    .uri(path)
                    .body(Body::empty())
                    .expect("request should build"),
            )
            .await
            .expect("request should complete");

        let status = response.status();
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should read");
        (
            status,
            String::from_utf8(body.to_vec()).expect("body should be UTF-8"),
        )
    }

    #[tokio::test]
    async fn work_facets_rejects_non_art_gallery() {
        let (status, body) = request_work_facets("/api/works/facets?gallery=meme").await;

        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert!(body.contains("art gallery only"));
    }

    #[tokio::test]
    async fn work_facets_rejects_invalid_status() {
        let (status, body) =
            request_work_facets("/api/works/facets?gallery=art&status=archived").await;

        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert!(body.contains("Invalid status parameter"));
    }

    #[tokio::test]
    async fn work_facets_requires_authentication_for_non_approved_status() {
        let (status, body) =
            request_work_facets("/api/works/facets?gallery=art&status=pending").await;

        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert!(body.contains("Authentication required to view non-approved facets"));
    }
}
