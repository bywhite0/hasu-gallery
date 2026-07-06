# Moderation Guidelines

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
