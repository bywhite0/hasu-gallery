use axum::{
    body::Body,
    extract::State,
    http::{HeaderMap, Request, StatusCode},
    middleware::Next,
    response::Response,
};
use sqlx::PgPool;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tower_sessions::Session;

#[derive(Clone)]
pub struct RateLimiter {
    inner: Arc<Mutex<HashMap<String, RateLimitBucket>>>,
    max_requests: u32,
    window: Duration,
}

#[derive(Clone, Debug)]
struct RateLimitBucket {
    window_started_at: Instant,
    requests: u32,
}

impl RateLimiter {
    pub fn new(max_requests: u32, window: Duration) -> Self {
        Self {
            inner: Arc::new(Mutex::new(HashMap::new())),
            max_requests,
            window,
        }
    }

    fn allow_at(&self, key: &str, now: Instant) -> bool {
        let mut buckets = self.inner.lock().expect("rate limiter mutex poisoned");
        let bucket = buckets
            .entry(key.to_string())
            .or_insert_with(|| RateLimitBucket {
                window_started_at: now,
                requests: 0,
            });

        if now.duration_since(bucket.window_started_at) >= self.window {
            bucket.window_started_at = now;
            bucket.requests = 0;
        }

        if bucket.requests >= self.max_requests {
            return false;
        }

        bucket.requests += 1;
        true
    }
}

pub async fn rate_limit(
    State(limiter): State<RateLimiter>,
    request: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let key = request_rate_limit_key(&request);
    if !limiter.allow_at(&key, Instant::now()) {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    Ok(next.run(request).await)
}

fn request_rate_limit_key(request: &Request<Body>) -> String {
    format!(
        "{}:{}:{}",
        client_fingerprint(request.headers()),
        request.method(),
        request.uri().path()
    )
}

fn client_fingerprint(headers: &HeaderMap) -> String {
    headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|value| value.to_str().ok())
                .map(str::trim)
                .filter(|value| !value.is_empty())
        })
        .unwrap_or("unknown")
        .to_string()
}

/// Middleware to require moderator or admin role
pub async fn require_moderator(
    session: Session,
    State(pool): State<PgPool>,
    request: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    // Get user_id from session
    let user_id: i64 = session
        .get("user_id")
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Query user role from database
    let role: String = sqlx::query_scalar(
        "SELECT role::TEXT FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Check if user is moderator or admin
    if role != "moderator" && role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }

    // User is authorized, proceed
    Ok(next.run(request).await)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rate_limiter_blocks_after_limit_until_window_resets() {
        let limiter = RateLimiter::new(2, Duration::from_secs(60));
        let start = Instant::now();

        assert!(limiter.allow_at("client-a", start));
        assert!(limiter.allow_at("client-a", start + Duration::from_secs(1)));
        assert!(!limiter.allow_at("client-a", start + Duration::from_secs(2)));
        assert!(limiter.allow_at("client-a", start + Duration::from_secs(61)));
    }

    #[test]
    fn rate_limiter_tracks_keys_independently() {
        let limiter = RateLimiter::new(1, Duration::from_secs(60));
        let start = Instant::now();

        assert!(limiter.allow_at("client-a", start));
        assert!(!limiter.allow_at("client-a", start + Duration::from_secs(1)));
        assert!(limiter.allow_at("client-b", start + Duration::from_secs(1)));
    }

    #[test]
    fn client_fingerprint_prefers_forwarded_headers() {
        let mut headers = HeaderMap::new();
        headers.insert("x-real-ip", "198.51.100.2".parse().unwrap());
        headers.insert(
            "x-forwarded-for",
            "203.0.113.7, 198.51.100.2".parse().unwrap(),
        );

        assert_eq!(client_fingerprint(&headers), "203.0.113.7");
    }
}
