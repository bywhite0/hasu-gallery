use axum::{
    body::Body,
    extract::State,
    http::{HeaderMap, HeaderValue, Method, Request, StatusCode, Uri},
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

pub async fn request_observability(request: Request<Body>, next: Next) -> Response {
    let method = request.method().clone();
    let path = request.uri().path().to_string();
    let started_at = Instant::now();
    let mut response = next.run(request).await;
    let status = response.status();
    let duration_ms = started_at.elapsed().as_millis();

    if let Ok(value) = HeaderValue::from_str(&duration_ms.to_string()) {
        response
            .headers_mut()
            .insert("x-request-duration-ms", value);
    }

    tracing::info!(
        method = %method,
        path = %path,
        status = status.as_u16(),
        duration_ms,
        "request completed"
    );

    response
}

#[derive(Clone)]
pub struct CsrfOriginGuard {
    allowed_origins: Arc<Vec<String>>,
}

impl CsrfOriginGuard {
    pub fn new(allowed_origins: Vec<String>) -> Self {
        let allowed_origins = allowed_origins
            .into_iter()
            .map(|origin| origin.trim().trim_end_matches('/').to_string())
            .filter(|origin| !origin.is_empty())
            .collect();

        Self {
            allowed_origins: Arc::new(allowed_origins),
        }
    }

    fn allows(&self, method: &Method, headers: &HeaderMap) -> bool {
        if matches!(method, &Method::GET | &Method::HEAD | &Method::OPTIONS) {
            return true;
        }

        if let Some(origin) = header_value(headers, "origin") {
            return self.is_allowed_origin(&origin);
        }

        if let Some(referer) = header_value(headers, "referer") {
            return referer_origin(&referer)
                .map(|origin| self.is_allowed_origin(&origin))
                .unwrap_or(false);
        }

        true
    }

    fn is_allowed_origin(&self, origin: &str) -> bool {
        let origin = origin.trim().trim_end_matches('/');
        self.allowed_origins.iter().any(|allowed| allowed == origin)
    }
}

pub async fn csrf_origin_guard(
    State(guard): State<CsrfOriginGuard>,
    request: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    if !guard.allows(request.method(), request.headers()) {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(next.run(request).await)
}

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

fn header_value(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn referer_origin(value: &str) -> Option<String> {
    let uri = value.parse::<Uri>().ok()?;
    Some(format!("{}://{}", uri.scheme_str()?, uri.authority()?))
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

    #[test]
    fn csrf_guard_allows_safe_methods_and_missing_browser_origin() {
        let guard = CsrfOriginGuard::new(vec!["http://localhost:5173".to_string()]);
        let headers = HeaderMap::new();

        assert!(guard.allows(&Method::GET, &headers));
        assert!(guard.allows(&Method::POST, &headers));
    }

    #[test]
    fn csrf_guard_checks_origin_and_referer_for_unsafe_methods() {
        let guard = CsrfOriginGuard::new(vec!["http://localhost:5173".to_string()]);
        let mut headers = HeaderMap::new();
        headers.insert("origin", "http://localhost:5173".parse().unwrap());

        assert!(guard.allows(&Method::POST, &headers));

        headers.insert("origin", "https://evil.example".parse().unwrap());
        assert!(!guard.allows(&Method::POST, &headers));

        headers.remove("origin");
        headers.insert(
            "referer",
            "http://localhost:5173/upload?next=1".parse().unwrap(),
        );
        assert!(guard.allows(&Method::PATCH, &headers));
    }

    #[test]
    fn csrf_guard_rejects_malformed_referer_for_unsafe_methods() {
        let guard = CsrfOriginGuard::new(vec!["http://localhost:5173".to_string()]);
        let mut headers = HeaderMap::new();
        headers.insert("referer", "/relative".parse().unwrap());

        assert!(!guard.allows(&Method::POST, &headers));
    }
}
