# Moderation Guidelines

> **Current-runtime document.** These rules cover the implemented Meme/Art
> workflow. Architecture V2 adds Fiction revision and series moderation, but
> that service is not implemented yet. See
> [Architecture V2](../.ccg/spec/architecture-v2.md).

Moderation keeps public galleries safe, searchable, and rights-aware. Every
submission starts as `pending` and must be reviewed before it appears in public
approved listings.

## Roles

Moderators and admins can:
- View the moderation queue.
- Approve, reject, or takedown works.
- Read moderation logs.

Members can:
- Upload works.
- View their own pending works.
- View public approved works.

## Review States

- `pending`: waiting for review
- `approved`: eligible for public gallery listing
- `rejected`: not accepted for publication
- `takedown`: removed after publication or rejected for a policy/rights issue

## State transitions

Moderator-driven transitions only:

| From | To |
|------|----|
| `pending` | `approved` |
| `pending` | `rejected` |
| `approved` | `takedown` |

Uploader resubmit (`rejected` → `pending`) is not exposed on the status API yet.
Illegal transitions are rejected with HTTP 409.

## Content rating access

Art ratings:

- `all_ages`: public to guests
- `r15` / `r18`: require authentication for list, facets scope, and detail

There is not yet a separate age-confirmation preference field; login is the
minimum gate for mature ratings.

## Approval Checklist

Approve only when:
- The uploaded file is a valid image and preview renders.
- Gallery selection is correct: meme vs art.
- Meme origin is present and source is provided for derived or fan-made works.
- Art submissions include artist, rating, and source URL.
- The title is usable and not misleading.
- The submission does not contain obvious rights, safety, or abuse issues.

## Rejection Checklist

Reject when:
- Required attribution is missing or clearly wrong.
- The wrong gallery or metadata was selected.
- The image is broken, unreadable, or unrelated.
- The work violates content policy or rights expectations.

Use a review note when the decision needs context. Empty notes are stored as
`NULL`; non-empty notes are trimmed and limited to 1000 characters.

## Takedown Checklist

Use `takedown` for works that need removal after approval, including:
- Rights holder request.
- Misattribution discovered after approval.
- Safety or abuse concern.
- Duplicate or corrupted media discovered later.

## Audit Expectations

Each status change writes a moderation log entry with actor, action, note, and
timestamp. Prefer concise notes that explain the decision without including
private user information.


## Media after takedown

Takedown best-effort deletes original and thumbnail objects from the media
bucket. If a CDN sits in front of the bucket, operators must purge or invalidate
cached URLs according to the deployment runbook. Source deletion alone does not
guarantee immediate CDN expiry.
