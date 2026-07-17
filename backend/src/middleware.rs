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
    net::SocketAddr,
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

const DEFAULT_MAX_BUCKETS: usize = 10_000;

#[derive(Clone)]
pub struct RateLimiter {
    inner: Arc<Mutex<HashMap<String, RateLimitBucket>>>,
    max_requests: u32,
    window: Duration,
    max_buckets: usize,
    trust_proxy_headers: bool,
}

#[derive(Clone, Debug)]
struct RateLimitBucket {
    window_started_at: Instant,
    requests: u32,
}

impl RateLimiter {
    pub fn new(max_requests: u32, window: Duration) -> Self {
        Self::with_options(max_requests, window, DEFAULT_MAX_BUCKETS, false)
    }

    pub fn with_options(
        max_requests: u32,
        window: Duration,
        max_buckets: usize,
        trust_proxy_headers: bool,
    ) -> Self {
        Self {
            inner: Arc::new(Mutex::new(HashMap::new())),
            max_requests,
            window,
            max_buckets: max_buckets.max(1),
            trust_proxy_headers,
        }
    }

    pub fn trust_proxy_headers(&self) -> bool {
        self.trust_proxy_headers
    }

    fn allow_at(&self, key: &str, now: Instant) -> bool {
        let mut buckets = self.inner.lock().expect("rate limiter mutex poisoned");
        self.evict_locked(&mut buckets, now);

        if !buckets.contains_key(key) && buckets.len() >= self.max_buckets {
            // Make room for a new key by dropping the oldest remaining window.
            if let Some(oldest_key) = buckets
                .iter()
                .min_by_key(|(_, bucket)| bucket.window_started_at)
                .map(|(k, _)| k.clone())
            {
                buckets.remove(&oldest_key);
            }
        }

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

    fn evict_locked(&self, buckets: &mut HashMap<String, RateLimitBucket>, now: Instant) {
        buckets.retain(|_, bucket| now.duration_since(bucket.window_started_at) < self.window);

        if buckets.len() <= self.max_buckets {
            return;
        }

        let mut entries: Vec<(String, Instant)> = buckets
            .iter()
            .map(|(key, bucket)| (key.clone(), bucket.window_started_at))
            .collect();
        entries.sort_by_key(|(_, started_at)| *started_at);

        let remove_count = buckets.len().saturating_sub(self.max_buckets);
        for (key, _) in entries.into_iter().take(remove_count) {
            buckets.remove(&key);
        }
    }

    #[cfg(test)]
    fn bucket_count(&self) -> usize {
        self.inner
            .lock()
            .expect("rate limiter mutex poisoned")
            .len()
    }
}

pub async fn rate_limit(
    State(limiter): State<RateLimiter>,
    request: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let key = request_rate_limit_key(&request, limiter.trust_proxy_headers());
    if !limiter.allow_at(&key, Instant::now()) {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    Ok(next.run(request).await)
}

fn request_rate_limit_key(request: &Request<Body>, trust_proxy_headers: bool) -> String {
    format!(
        "{}:{}:{}",
        client_fingerprint(request, trust_proxy_headers),
        request.method(),
        request.uri().path()
    )
}

fn client_fingerprint(request: &Request<Body>, trust_proxy_headers: bool) -> String {
    if trust_proxy_headers {
        if let Some(forwarded) = header_value(request.headers(), "x-forwarded-for")
            .and_then(|value| {
                value
                    .split(',')
                    .next()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(ToString::to_string)
            })
        {
            return forwarded;
        }

        if let Some(real_ip) = header_value(request.headers(), "x-real-ip") {
            return real_ip;
        }
    }

    if let Some(addr) = request.extensions().get::<axum::extract::ConnectInfo<SocketAddr>>() {
        return addr.0.ip().to_string();
    }

    "unknown".to_string()
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
    let role: String = sqlx::query_scalar("SELECT role::TEXT FROM users WHERE id = $1")
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
    use axum::http::Request as HttpRequest;

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
    fn rate_limiter_evicts_expired_and_caps_bucket_count() {
        let limiter = RateLimiter::with_options(1, Duration::from_secs(10), 2, false);
        let start = Instant::now();

        assert!(limiter.allow_at("a", start));
        assert!(limiter.allow_at("b", start));
        assert!(limiter.allow_at("c", start + Duration::from_secs(1)));
        assert!(limiter.bucket_count() <= 2);

        // After the window, expired keys are removed before insert.
        assert!(limiter.allow_at("d", start + Duration::from_secs(11)));
        assert!(limiter.bucket_count() <= 2);
    }

    #[test]
    fn client_fingerprint_ignores_proxy_headers_unless_trusted() {
        let mut request = HttpRequest::builder()
            .method("POST")
            .uri("/api/auth/login")
            .body(Body::empty())
            .unwrap();
        request
            .headers_mut()
            .insert("x-forwarded-for", "203.0.113.7, 198.51.100.2".parse().unwrap());
        request
            .headers_mut()
            .insert("x-real-ip", "198.51.100.2".parse().unwrap());

        assert_eq!(client_fingerprint(&request, false), "unknown");
        assert_eq!(client_fingerprint(&request, true), "203.0.113.7");
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
