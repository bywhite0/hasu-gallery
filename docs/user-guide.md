# User Guide

> **Current-runtime document.** This guide covers the implemented Meme and Art
> galleries. Architecture V2 adds Fiction publishing, series, and reading, but
> those routes are not available yet. See
> [Architecture V2](../.ccg/spec/architecture-v2.md).

Hasu Gallery has two public galleries:
- Meme Gallery for official, derived, and fan-made meme content.
- Art Gallery for fan artwork.

## Browsing

Open either gallery from the top navigation:
- Meme Gallery supports origin and sort filters.
- Art Gallery supports artist, medium, rating, and sort filters.

Art rating preference is stored locally in `hasu-gallery-preferences` so reloads
restore the last selected rating. Guests can only browse All Ages art; R-15 and
R-18 listings and detail pages require sign-in.

## Uploading

Sign in before uploading. All uploads enter the moderation queue as `pending`.

Image requirements:
- PNG, JPEG, GIF, or WebP
- Maximum 10 MB
- Maximum 8192 px per side
- Maximum 64 MP total
- Filename extension must be present and must match the detected image format

## Meme Uploads

Required:
- Title
- Gallery: Meme
- Origin: Official, Derived, or Fan Made

For Derived or Fan Made, include a source note so moderators can review
provenance.

## Art Uploads

Required:
- Title
- Gallery: Art
- Artist
- Rating: All Ages, R-15, or R-18
- Source URL

Optional:
- Medium, such as Digital, Watercolor, or Pencil
- Source note

## After Upload

Pending works are visible to the uploader and moderators. Approved works appear
in public gallery listings. Rejected or takedown works remain out of public
approved listings.

## Local E2E Smoke

Developers can run local browser smoke tests with:

```powershell
npx pnpm@10.26.2 e2e
```

These tests cover Art facets/rating preference and upload-to-moderation approve
flow with mocked API responses.
