use axum::{
    Router,
    routing::get,
    response::IntoResponse,
    http::StatusCode,
    extract::State,
};
use std::net::SocketAddr;
use tower_http::cors::{CorsLayer, Any};

mod db;

#[derive(Clone)]
struct AppState {
    db: db::DbPool,
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

    // Create shared state
    let state = AppState { db };

    // Build router
    let app = Router::new()
        .route("/health", get(health_check))
        .with_state(state)
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
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
