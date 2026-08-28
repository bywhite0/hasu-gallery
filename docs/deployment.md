# Deployment Guide

> **Current-runtime document.** This guide describes the deployed Phase 1-5
> baseline (independent SPA + JSON API). Architecture V3 S1–S3 code has
> shipped, so the single-binary same-origin topology below is ready to cut
> over to; the split topology remains supported until the cutover passes its
> rollback window. See [Architecture V3](../.ccg/spec/architecture-v3.md).

Hasu Gallery is currently deployed as a static frontend plus an independent
Rust API.
The API owns Postgres, sessions, S3-compatible object storage, thumbnail
generation, upload validation, moderation, and public media URL construction.

## Single-Binary Deployment (Architecture V3)

The recommended production shape is one `galleryd` executable serving the
embedded SPA and the JSON API from the same origin:

```powershell
pnpm run build:galleryd          # SPA build + embed sync + cargo release build
./backend/target/release/galleryd migrate
./backend/target/release/galleryd serve
```

Properties and cutover notes:

- SPA history routes fall back to the embedded `index.html`; no Node.js, pnpm,
  or separate frontend server is required in production.
- Same-origin means browsers send no cross-origin requests;
  `CORS_ALLOWED_ORIGINS` must still contain the site origin because the CSRF
  Origin/Referer guard uses the same list.
- Security headers are always on: nosniff, `Referrer-Policy`,
  `X-Frame-Options: DENY`, `Permissions-Policy`, and a CSP on HTML documents.
  `Strict-Transport-Security` is sent when `SESSION_COOKIE_SECURE=true`.
- Cutover: deploy `galleryd serve` behind the existing TLS proxy, point the
  site origin at it, keep the old static-frontend deployment untouched for the
  rollback window, then retire it.
- Rollback: repoint the origin at the previous static frontend + API pair; no
  data migration is involved.

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

Since Architecture V3 S2, media objects use UUIDv4 media IDs with a
private/public key split inside one bucket:

- `private/{media_id}/original.{ext}` and `private/{media_id}/thumb.jpg`:
  pending/rejected uploads and retained originals. Never publicly served;
  owners and moderators view them through short-lived (300 s) presigned GET
  URLs issued by the API.
- `public/{media_id}/v{n}/image.{ext}` and `public/{media_id}/v{n}/thumb.jpg`:
  approved sanitized objects, copied server-side at approval time. These are
  immutable; cache them aggressively.

Public URLs are `PUBLIC_MEDIA_BASE_URL` plus the object key (the key includes
the `public/` prefix), so the CDN/proxy keeps the existing `<base>/<key>`
mapping. JPEG/PNG public originals are re-encoded on upload to strip
EXIF/XMP-style metadata. GIF/WebP keep container bytes so animation is
preserved.

Required CDN/proxy behavior:
- **Deny `private/*` paths.** The proxy must only serve `public/*` (plus
  legacy root-level keys during the migration window). Presigned URLs go
  directly to the S3/MinIO endpoint and bypass the CDN.
- Allow the production frontend origin for hotlinked `<img>` requests; a WAF
  rule that blocks site Referer will break every gallery page.
- Do not use Referer alone as the media authorization mechanism.
- Cache `public/{media_id}/v{n}/...` as immutable; on takedown the API deletes
  the public objects and operators must purge CDN URLs.
- Keep API JSON responses separate from media CDN caching.

### Legacy media backfill

Works uploaded before S2 store objects at root-level `{work_id}.{ext}` keys.
Run once after deploying S2:

```powershell
cargo run --manifest-path backend/Cargo.toml --bin galleryd -- backfill-media
```

- Approved works are copied to `public/{uuid}/v1/...`; legacy objects are kept
  so old URLs continue to work during the rollback window (delete them after
  the window closes).
- Pending/rejected works are moved to `private/...` and their legacy publicly
  reachable objects are deleted, closing the pre-S2 exposure gap.

The S3/MinIO endpoint must be reachable from browsers for presigned review
URLs (MinIO on `http://localhost:9000` in development).

## Production Checklist

- Run all migrations before starting the API.
- Set `CORS_ALLOWED_ORIGINS` to the exact frontend origin.
- Set `SESSION_COOKIE_SECURE=true` so the session cookie uses the `__Host-`
  prefix and `Secure` attribute over HTTPS.
- Set `PUBLIC_MEDIA_BASE_URL` to the public CDN/proxy URL.
- Confirm the CDN/proxy denies `private/*` object paths.
- Run `galleryd backfill-media` once after the first S2 deploy.
- Confirm upload, moderation approval, public gallery listing, and detail page.
- Keep `pnpm e2e` as a local release smoke test.
