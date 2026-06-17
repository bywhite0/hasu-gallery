use axum::{
    Router,
    routing::{get, post},
    response::IntoResponse,
    http::StatusCode,
    extract::State,
};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tower_sessions::{SessionManagerLayer, Expiry};
use tower_sessions_sqlx_store::PostgresStore;

mod db;
mod auth;
mod models;
mod routes;
mod storage;
mod image_processor;

#[derive(Clone)]
struct AppState {
    db: db::DbPool,
    s3_client: aws_sdk_s3::Client,
}

#[tokio::main]
async fn main() {
    // Load environment variables
    dotenv::dotenv().ok();

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

    // Build router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/auth/register", post(routes::auth::register))
        .route("/api/auth/login", post(routes::auth::login))
        .route("/api/auth/logout", post(routes::auth::logout))
        .route("/api/auth/me", get(routes::auth::me))
        .route("/api/works", get(routes::works::handle_works_list))
        .route("/api/works/:id", get(routes::works::handle_work_detail))
        .route("/api/works/upload", post(routes::upload::upload_work))
        .route("/api/users/me/works", get(routes::users::handle_my_works))
        .route("/api/users/me/stats", get(routes::users::handle_my_stats))
        .with_state(state)
        .layer(session_layer)
        .layer(
            CorsLayer::new()
                .allow_origin([
                    "http://localhost:5173".parse().unwrap(),
                    "http://127.0.0.1:5173".parse().unwrap(),
                ])
                .allow_methods([
                    axum::http::Method::GET,
                    axum::http::Method::POST,
                    axum::http::Method::PUT,
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
