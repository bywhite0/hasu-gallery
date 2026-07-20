# Deployment Guide

> **Current-runtime document.** This guide describes the deployed Phase 1-5
> baseline. The approved but not-yet-implemented target is the single-binary,
> same-origin Protobuf topology in
> [Architecture V2](../.ccg/spec/architecture-v2.md). Update this guide only
> when the corresponding migration slice has shipped and passed rollback
> checks.

Hasu Gallery is currently deployed as a static frontend plus an independent
Rust API.
The API owns Postgres, sessions, S3-compatible object storage, thumbnail
generation, upload validation, moderation, and public media URL construction.

## Runtime Services

Required:
- Node.js 20+ and pnpm 10.26.2 for frontend build
- Rust stable for backend build
- Postgres 16+
- S3-compatible object storage, such as MinIO
- A public CDN or reverse proxy for uploaded media

## Environment Variables

Backend:

```powershell
DATABASE_URL=postgres://user:password@host:5432/hasu_gallery
S3_ENDPOINT=http://minio.internal:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=hasu-gallery
PUBLIC_MEDIA_BASE_URL=https://assets.example.com/hasu-gallery
CORS_ALLOWED_ORIGINS=https://gallery.example.com
TRUST_PROXY_HEADERS=false
SESSION_COOKIE_SECURE=true
RUST_LOG=info,sqlx=warn
```

Set `TRUST_PROXY_HEADERS=true` only when a trusted reverse proxy overwrites
`X-Forwarded-For` / `X-Real-IP`. When false (default), rate limiting uses the
TCP peer address and ignores client-supplied proxy headers.

Set `SESSION_COOKIE_SECURE=true` in production (same-origin HTTPS). It enables
the `__Host-` session cookie name prefix plus the `Secure` attribute; the cookie
always uses `SameSite=Lax` and `HttpOnly`. Leave it unset/false for local http
development, where a `Secure` / `__Host-` cookie would be rejected by the browser
over cross-port http.

Frontend:

```powershell
VITE_API_BASE_URL=https://api.example.com
```

For localhost, the frontend client defaults to `http://127.0.0.1:8787` for JSON
API requests. Upload uses `/api/works/upload` so the dev proxy can forward
multipart requests.

## Database Migrations

Apply migrations in lexical order:

```bash
for migration in backend/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$migration"
done
```

The GitHub Actions backend job uses the same pattern before `cargo test`.

## Build

Frontend:

```powershell
npx pnpm@10.26.2 install --frozen-lockfile
npx pnpm@10.26.2 build
```

Backend:

```powershell
cargo build --release --manifest-path backend/Cargo.toml
```

## Local Verification

```powershell
cargo test --manifest-path backend/Cargo.toml
npx pnpm@10.26.2 typecheck
npx pnpm@10.26.2 e2e
```

E2E tests are local-only by design. CI remains lightweight and does not install
Playwright browsers.

## Monitoring

See [Monitoring Runbook](monitoring.md) for request duration logs, the
moderator/admin monitoring summary API, error tracking log-drain expectations,
and Postgres query profiling.

## Media And CDN

Uploaded objects are stored in S3 using UUID-based keys. Public URLs are
constructed from `PUBLIC_MEDIA_BASE_URL`; trailing slashes are removed before
joining keys.

JPEG/PNG public originals are re-encoded on upload to strip EXIF/XMP-style
metadata. GIF/WebP keep container bytes so animation is preserved.

Recommended CDN/proxy behavior:
- Allow the production frontend origin for hotlinked `<img>` requests; a WAF
  rule that blocks site Referer will break every gallery page.
- Do not use Referer alone as the media authorization mechanism.
- Cache approved originals/thumbnails carefully; on takedown the API deletes
  source objects and operators must purge CDN URLs.
- Proxy `https://assets.example.com/hasu-gallery/<key>` to the S3 bucket.
- Keep API JSON responses separate from media CDN caching.

Known limitation: pending objects currently use the same public media base URL
as approved works. UUID keys reduce casual guessing, but true private staging
(private bucket or auth media proxy) remains a follow-up before high-sensitivity
deployments. Architecture V2 replaces this with UUIDv4 media IDs, a private
staging/review namespace, and public sanitized variants only.

## Production Checklist

- Run all migrations before starting the API.
- Set `CORS_ALLOWED_ORIGINS` to the exact frontend origin.
- Set `SESSION_COOKIE_SECURE=true` so the session cookie uses the `__Host-`
  prefix and `Secure` attribute over HTTPS.
- Set `PUBLIC_MEDIA_BASE_URL` to the public CDN/proxy URL.
- Confirm upload, moderation approval, public gallery listing, and detail page.
- Keep `pnpm e2e` as a local release smoke test.
