# API Reference

> **Current-runtime document.** This page documents the existing JSON API used by
> the product UI. Architecture V2 also exposes a growing plain HTTP + Protobuf
> surface under `/api/v2`. Slice A/B currently ship:
>
> - `GET /api/v2/public/health`
> - `GET /api/v2/public/works`
> - `GET /api/v2/public/works/{id}`
> - `GET /api/v2/public/works/facets`
>
> with media type `application/vnd.hasu-gallery.v2+protobuf`. Public V2 routes do
> not inspect cookies and only return approved all-ages content. Fiction and the
> remaining command families are not implemented yet. See
> [Architecture V2](../.ccg/spec/architecture-v2.md).

Hasu Gallery API uses cookie-backed sessions. Browser clients should send
credentials with every request. JSON endpoints return non-2xx responses with a
plain error string or JSON error payload depending on the handler.

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
