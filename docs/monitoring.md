# Monitoring Runbook

This runbook defines the baseline production monitoring setup for Hasu Gallery.
It intentionally avoids requiring a specific SaaS vendor; Sentry, Grafana,
CloudWatch, Better Stack, or another log/APM provider can consume the same
signals.

## Application Signals

The Rust API emits structured tracing logs. Set:

```powershell
RUST_LOG=info,sqlx=warn
```

Every request passes through the request observability middleware:
- Logs method, path, status, and duration.
- Adds `x-request-duration-ms` to responses.

Use the response header for smoke probes and the log fields for dashboards or
alerts.

## Error Tracking

Baseline error tracking is log based:
- Ship API stdout/stderr to the deployment platform log drain.
- Alert on `ERROR` logs and repeated 5xx responses.
- Include request method/path/status/duration fields in the log processor.

Recommended alert rules:
- Any sustained 5xx rate above 1 percent for 5 minutes.
- Upload endpoint 5xx burst.
- Moderation status update failures.
- Database health check failures.

If using Sentry or another SDK later, attach it at the request observability
middleware boundary so request method/path/status and duration stay consistent.

## Monitoring Summary API

`GET /api/monitoring/summary` is moderator/admin only and returns:
- `total_uploads`
- `approved_uploads`
- `pending_backlog`
- `approval_rate` (`approved_uploads / total_uploads`)
- `upload_success_rate` (deprecated alias of `approval_rate`)
- `pending_by_gallery`

Do not treat `upload_success_rate` as multipart or S3 transport success. Track
upload 5xx / object-store errors from request logs for that signal.

Use it for a lightweight operations dashboard and release smoke checks.

Example probe:

```powershell
curl -i -b session.cookie https://api.example.com/api/monitoring/summary
```

## Database Query Profiling

Enable `pg_stat_statements` on Postgres when available:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

Useful profiling query:

```sql
SELECT
  calls,
  round(total_exec_time::numeric, 2) AS total_ms,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  rows,
  query
FROM pg_stat_statements
WHERE query ILIKE '%works%'
ORDER BY mean_exec_time DESC
LIMIT 20;
```

Index-sensitive paths to watch:
- `GET /api/works?gallery=&status=&sort=created_at_desc`
- `GET /api/works?gallery=art&rating=`
- `GET /api/works/facets?gallery=art`
- `GET /api/moderation/queue?gallery=&status=pending`
- `GET /api/users/me/works`

## Release Checks

Before a production release:

```powershell
cargo test --manifest-path backend/Cargo.toml
npx pnpm@10.26.2 typecheck
npx pnpm@10.26.2 e2e
```

After deploy:
- Check `/health`.
- Check one public gallery page.
- Check `x-request-duration-ms` exists on API responses.
- Check monitoring summary as a moderator/admin.
- Confirm logs are arriving in the chosen error tracking/log platform.
