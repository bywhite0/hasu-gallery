# API Reference

> **Current-runtime document.** This page documents the JSON API used by the
> product UI. Architecture V3 (2026-08-28) made the JSON contract the single
> business API: the former `/api/v2` Protobuf surface has been removed and the
> Fiction routes below replaced it. See
> [Architecture V3](../.ccg/spec/architecture-v3.md).

Hasu Gallery API uses cookie-backed sessions. Browser clients should send
credentials with every request. JSON endpoints return non-2xx responses with a
plain error string or JSON error payload depending on the handler. Fiction
endpoints always return structured errors: `{ "code": "...", "message": "..." }`.

## Auth

### `POST /api/auth/register`

Creates a member account and starts a session. Rate limited per client and route
(default: 5 requests / hour).

Request:

```json
{
  "handle": "hasu_user",
  "email": "user@example.com",
  "password": "password123",
  "display_name": "Hasu User"
}
```

Notes:
- `handle`, `email`, and `display_name` are trimmed before validation.
- `email` is lowercased before storage.
- `password` is not trimmed.

### `POST /api/auth/login`

Starts a session for an existing user. Rate limited per client and route
(default: 10 requests / minute).

Request:

```json
{
  "handle": "hasu_user",
  "password": "password123"
}
```

### `POST /api/auth/logout`

Deletes the active session.

### `GET /api/auth/me`

Returns the active user or `401` when unauthenticated.

Response fields: `id`, `handle`, `email`, `display_name`, `role`, `created_at`
(ISO-8601).

## Account

Authenticated member endpoints for the current user's private workspace.

### `GET /api/users/me/stats`

Returns submission counters for the signed-in user.

Response:

```json
{
  "total": 4,
  "pending": 1,
  "approved": 1,
  "rejected": 1,
  "takedown": 1
}
```

### `GET /api/users/me/works`

Lists works uploaded by the signed-in user.

Query parameters:
- `status`: optional, `pending`, `approved`, `rejected`, or `takedown`
- `page`: optional, defaults to `1`
- `limit`: optional, defaults to `24`, maximum `100`

The response shape matches the works list response and may include uploader-only
review fields:
- `reviewed_at`: ISO timestamp when a moderator decision exists
- `review_note`: private reviewer note for the uploader

## Works

### `GET /api/works`

Lists works.

Query parameters:
- `gallery`: required, `meme` or `art`
- `status`: optional, defaults to `approved`
- `origin`: meme-only, `official`, `derived`, or `fan_made`
- `artist`: art-only contains filter
- `medium`: art-only contains filter
- `rating`: art-only, defaults to `all_ages`. Guests may only request
  `all_ages`; `r15` / `r18` require authentication.
- `page`: optional, defaults to `1`
- `limit`: optional, defaults to `24`, maximum `100`
- `sort`: `created_at_desc`, `created_at_asc`, or `title_asc`

Non-approved statuses require moderator or admin role.

### `GET /api/works/facets`

Returns Art Gallery facets for filter suggestions and counts.

Query parameters:
- `gallery`: currently must be `art`
- `status`: optional, defaults to `approved`

Non-approved facets require moderator or admin role.

Response:

```json
{
  "artists": [{ "value": "Artist", "label": "Artist", "count": 2 }],
  "media": [{ "value": "Digital", "label": "Digital", "count": 2 }],
  "ratings": [{ "value": "all_ages", "label": "All Ages", "count": 2 }]
}
```

### `GET /api/works/:id`

Returns a single work. Non-approved works are visible only to the uploader,
moderators, or admins. Approved art with rating `r15` or `r18` requires
authentication; guests receive `401`.

### `POST /api/works/upload`

Uploads a work. Requires an authenticated session and multipart form data.
Rate limited per client and route.

Shared fields:
- `file`: required image file, max 10 MB
- `title`: required, max 200 characters
- `gallery`: `meme` or `art`
- `source`: optional, max 2000 characters
- `source_url`: required for art, absolute HTTP(S) URL, max 2048 characters

Meme fields:
- `origin`: required, `official`, `derived`, or `fan_made`
- `source`: required for `derived` and `fan_made`

Art fields:
- `artist`: required, max 200 characters
- `medium`: optional, max 100 characters
- `rating`: `all_ages`, `r15`, or `r18`

Upload validation:
- File bytes are sniffed server-side.
- Allowed detected formats: PNG, JPEG, GIF, WebP.
- When a filename is present, its extension must match the detected format.
- Image dimensions are capped at 8192 px per side and 64 MP total.

## Fiction

Fiction endpoints return structured JSON errors (`code`, `message`) and use
snake_case fields. Public routes do not inspect cookies and only return
approved, all-ages published revisions; private routes use
`Cache-Control: no-store`.

### `GET /api/fictions`

Public list of published fictions (metadata + excerpt only, no bodies).

Query parameters:
- `page`: optional, defaults to `1`
- `limit`: optional, defaults to `24`, maximum `50`
- `q`: optional title/synopsis contains filter
- `fandom`: optional fandom contains filter

Response: `{ items, page, limit, total, total_pages }`; each item carries
`id`, `title`, `summary`, `content_rating`, `cover_media_id`,
`author_handle`, `fandom`, `language`, `word_count`,
`published_revision_id`. Cached with
`public, max-age=60, stale-while-revalidate=120`.

### `GET /api/fictions/:work_id`

Public detail of the currently published revision, including `body`
(safe Hasu Fiction Markup source), `published_at`, and `content_sha256`.
The response carries a strong ETag derived from `content_sha256`.
Returns `404` when the work has no approved published revision.

### `GET /api/users/me/fictions`

Authenticated. Lists the caller's fiction works with the latest revision per
work (`fiction_id`, `state`, `revision_number`, `work_version`, draft fields).

### `POST /api/users/me/fictions`

Authenticated; rate limited. Creates a fiction work with a first draft
revision.

Request:

```json
{
  "title": "Title",
  "synopsis": "",
  "fandom": "",
  "language": "en",
  "content_rating": "all_ages",
  "body": "Markup body"
}
```

Body limit is 2 MiB plus envelope. Returns `201` with
`{ work_id, revision_id, revision_number, word_count }`.

### `PUT /api/users/me/fictions/:work_id/draft`

Authenticated; rate limited. Saves a draft revision (same fields as create,
without `language`). Editing a published work creates a new private revision.

### `POST /api/users/me/fictions/:work_id/submit`

Authenticated; rate limited. Submits the current draft for review.

Request: `{ "expected_work_version": 1 }` (optimistic concurrency; a stale
version returns `409` with code `version_conflict`).

### `GET /api/moderation/fictions`

Moderator/admin only. Returns pending fiction revisions oldest-first
(`items` of `id`, `fiction_id`, `title`, `body`, `revision_number`,
`content_rating`, `status`, `created_at`, `plain_text_excerpt`,
`word_count`).

### `POST /api/moderation/fictions/:work_id/revisions/:revision_id/decision`

Moderator/admin only; rate limited.

Request: `{ "decision": "approve" | "reject", "note": "optional" }`.

Approval atomically switches the work's published revision pointer; the
previous published revision remains readable until then. Returns
`{ work_id, revision_id, state }`.

## Moderation

Moderator/admin only.

### `GET /api/moderation/queue`

Query parameters:
- `gallery`: `meme` or `art`
- `status`: `pending`, `approved`, `rejected`, or `takedown`
- `page`: defaults to `1`
- `limit`: defaults to `20`, maximum `100`

### `PATCH /api/works/:id/status`

Changes review status and writes a moderation log entry.

Request:

```json
{
  "status": "approved",
  "note": "Looks good."
}
```

Allowed status values: `approved`, `rejected`, `takedown`.

Allowed transitions only:
- `pending` → `approved` | `rejected`
- `approved` → `takedown`

Illegal transitions return `409 Conflict` and leave the row unchanged.
`takedown` best-effort deletes source objects in the media bucket; purge any CDN
cache separately.

### `GET /api/moderation/log/:work_id`

Returns moderation log entries for a work.

### `GET /api/monitoring/summary`

Moderator/admin only. Returns operational counters for basic monitoring.

Response:

```json
{
  "total_uploads": 120,
  "approved_uploads": 100,
  "pending_backlog": 12,
  "approval_rate": 0.8333333333333334,
  "upload_success_rate": 0.8333333333333334,
  "pending_by_gallery": [
    { "gallery": "art", "count": 7 },
    { "gallery": "meme", "count": 5 }
  ]
}
```

`approval_rate` is `approved_uploads / total_uploads`. `upload_success_rate` is a
deprecated alias of the same value kept for existing dashboards; it is **not**
multipart transport success.

## CSRF And CORS

Unsafe methods validate browser `Origin` or `Referer` against
`CORS_ALLOWED_ORIGINS`. Requests without browser origin headers remain
compatible for server-side scripts and local tools.
