# Deployment Guide

Hasu Gallery is deployed as a static frontend plus an independent Rust API.
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
RUST_LOG=info,sqlx=warn
```

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

Recommended CDN/proxy behavior:
- Cache uploaded original files and thumbnails as immutable objects.
- Proxy `https://assets.example.com/hasu-gallery/<key>` to the S3 bucket.
- Keep API JSON responses separate from media CDN caching.

## Production Checklist

- Run all migrations before starting the API.
- Set `CORS_ALLOWED_ORIGINS` to the exact frontend origin.
- Set `PUBLIC_MEDIA_BASE_URL` to the public CDN/proxy URL.
- Confirm upload, moderation approval, public gallery listing, and detail page.
- Keep `pnpm e2e` as a local release smoke test.
