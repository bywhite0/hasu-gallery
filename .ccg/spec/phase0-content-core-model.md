# Phase 0: hasu-gallery Content Core Model

**Status**: Draft  
**Created**: 2026-06-09  
**Last Updated**: 2026-06-09  
**Author**: Claude (with user input)  
**Scope**: Data model, authentication, moderation workflow for UGC platform evolution

---

## Executive Summary

This specification defines the foundational data model and moderation workflow for evolving `hasu-memes` into `hasu-gallery` — a dual-gallery platform supporting:

1. **Meme Gallery** (表情包画廊): Official assets + activity screenshots + fan-made memes
2. **Art Gallery** (美术部): Fan-created artwork (excluding memes)

Both galleries require **user upload + moderation**. This phase establishes the shared content spine (works, users, moderation) and gallery-specific metadata extensions before any code is written.

**Key Decisions Locked**:
- Database: **Postgres** (not SQLite)
- Architecture: **Core + extension tables** (not single denormalized table)
- Language: **Rust** (no rewrite to Go)
- Deduplication: **perceptual hash (pHash)** in MVP
- No historical data migration (3499 test items sufficient)

---

## 1. Content Classification Model

### 1.1 Dimensions

Two orthogonal dimensions + state:

| Dimension | Values | Description |
|-----------|--------|-------------|
| `gallery` | `meme` \| `art` | Top-level partition |
| `origin` | `official` \| `derived` \| `fan_made` | Meme provenance (NULL for art) |
| `status` | `pending` \| `approved` \| `rejected` \| `takedown` | Moderation state |

**Constraints**:
- Meme gallery = `gallery='meme'`, subdivided by `origin`
- Art gallery = `gallery='art'`, `origin` always NULL
- Existing facets (`source`/activity-record, `categories`) **scoped to meme only**

### 1.2 Metadata Attribution

| Metadata | Scope | Meme | Art | Implementation |
|----------|-------|------|-----|----------------|
| Characters | Shared | ✓ | ✓ | `work_characters` M2M |
| Tags | Shared | ✓ | ✓ | `work_tags` M2M |
| Categories | Meme-only | ✓ | — | `work_categories` M2M |
| Activity source | Meme-only | ✓ | — | `works.source` |
| Artist | Art-only | — | ✓ | `work_art_meta.artist` |
| Medium | Art-only | — | ✓ | `work_art_meta.medium` |
| Rating | Art-only | — | ✓ | `work_art_meta.rating` |
| Source URL | Required for art | Optional | ✓ | `works.source_url` |

---

## 2. Database Schema (Postgres)

### 2.1 Enums

```sql
CREATE TYPE gallery_kind AS ENUM ('meme', 'art');
CREATE TYPE meme_origin AS ENUM ('official', 'derived', 'fan_made');
CREATE TYPE work_status AS ENUM ('pending', 'approved', 'rejected', 'takedown');
CREATE TYPE user_role AS ENUM ('member', 'moderator', 'admin');
CREATE TYPE art_rating AS ENUM ('all_ages', 'r15', 'r18');
```

### 2.2 Core Tables

#### users

```sql
CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  handle        TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,                    -- argon2id
  role          user_role NOT NULL DEFAULT 'member',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### works (shared spine)

```sql
CREATE TABLE works (
  id                   TEXT PRIMARY KEY,
  gallery              gallery_kind NOT NULL,
  origin               meme_origin,                       -- NULL for art
  title                TEXT NOT NULL,
  status               work_status NOT NULL DEFAULT 'pending',
  uploader_id          BIGINT REFERENCES users(id),       -- NULL = official import
  file                 TEXT,
  asset_file           TEXT,
  thumbnail_file       TEXT,
  thumbnail_asset_file TEXT,
  width                INTEGER NOT NULL CHECK (width > 0),
  height               INTEGER NOT NULL CHECK (height > 0),
  source               TEXT NOT NULL DEFAULT '',          -- meme: activity source
  source_url           TEXT NOT NULL DEFAULT '',          -- art: original post link
  rights_note          TEXT NOT NULL DEFAULT '',
  phash                BIGINT,                            -- perceptual hash (dedup)
  search_tsv           TSVECTOR,                          -- full-text search
  reviewed_by          BIGINT REFERENCES users(id),
  reviewed_at          TIMESTAMPTZ,
  review_note          TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Integrity constraints
  CHECK ((gallery='meme' AND origin IS NOT NULL) OR (gallery='art' AND origin IS NULL)),
  CHECK ((file IS NOT NULL) OR (asset_file IS NOT NULL)),
  -- Provenance: derived/fan_made must have source
  CHECK (NOT (origin IN ('derived','fan_made')) OR source <> ''),
  -- Art must have source_url
  CHECK (gallery <> 'art' OR source_url <> '')
);

CREATE INDEX idx_works_gallery_status ON works(gallery, status);
CREATE INDEX idx_works_updated_at ON works(updated_at DESC);
CREATE INDEX idx_works_search ON works USING GIN(search_tsv);
CREATE INDEX idx_works_phash ON works(phash) WHERE phash IS NOT NULL;
```

**Note**: Media fields (`file`, `asset_file`, `thumbnail_*`) preserve current abstraction:
- `file`: explicit URL (e.g., CDN)
- `asset_file`: local filename → API generates public URL via `PUBLIC_MEME_MEDIA_BASE_URL`
- UGC uploads → object storage (S3-compatible) → populate `file` with object URL

### 2.3 Extension Tables

#### work_art_meta (art-specific, 1:1 with art works)

```sql
CREATE TABLE work_art_meta (
  work_id TEXT PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
  artist  TEXT NOT NULL,                         -- Artist credit (required)
  medium  TEXT,                                  -- Medium (illustration/pixel/3D...)
  rating  art_rating NOT NULL                    -- Content rating (required)
);
```

**Application constraint** (CHECK cannot enforce cross-table): Every `gallery='art'` work must have a `work_art_meta` row. Enforce in write transaction.

#### M2M associations (shared across galleries where applicable)

```sql
-- Characters: shared vocabulary
CREATE TABLE work_characters (
  work_id  TEXT REFERENCES works(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  position INTEGER,
  PRIMARY KEY (work_id, name)
);
CREATE INDEX idx_work_characters_work ON work_characters(work_id);
CREATE INDEX idx_work_characters_name ON work_characters(name);

-- Tags: shared vocabulary
CREATE TABLE work_tags (
  work_id  TEXT REFERENCES works(id) ON DELETE CASCADE,
  tag      TEXT NOT NULL,
  position INTEGER,
  PRIMARY KEY (work_id, tag)
);
CREATE INDEX idx_work_tags_work ON work_tags(work_id);
CREATE INDEX idx_work_tags_tag ON work_tags(tag);

-- Categories: meme-only (current se-hasu, etc.)
CREATE TABLE work_categories (
  work_id       TEXT REFERENCES works(id) ON DELETE CASCADE,
  category_slug TEXT NOT NULL,
  position      INTEGER,
  PRIMARY KEY (work_id, category_slug)
);
CREATE INDEX idx_work_categories_work ON work_categories(work_id);
CREATE INDEX idx_work_categories_slug ON work_categories(category_slug);

-- Category metadata (preserves current categories table)
CREATE TABLE categories (
  slug       TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  sort_order INTEGER
);
```

### 2.4 Moderation Log

```sql
CREATE TABLE moderation_log (
  id       BIGSERIAL PRIMARY KEY,
  work_id  TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  actor_id BIGINT NOT NULL REFERENCES users(id),
  action   TEXT NOT NULL,                -- submit/approve/reject/takedown/resubmit
  note     TEXT,
  at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_moderation_log_work ON moderation_log(work_id);
CREATE INDEX idx_moderation_log_at ON moderation_log(at DESC);
```

---

## 3. Moderation State Machine

```
                     ┌─ Auto Pre-screen ─┐
                     │ (MIME/size/pHash) │
  Upload ──────────▶ pending ────────────┼──approve──▶ approved (public)
                        │                              │
                        └──reject──▶ rejected          │
                             ▲        (can resubmit)   │
                             │                         │
                             └─────────────────────────┴──takedown──▶ (removed)
                                                         (legal/DMCA)
```

### 3.1 State Transitions

| From | To | Actor | Triggers |
|------|------|-------|----------|
| — | `pending` | uploader | Submit upload → auto pre-screen |
| `pending` | `approved` | moderator | Manual review pass |
| `pending` | `rejected` | moderator | Manual review fail + reason |
| `rejected` | `pending` | uploader | Resubmit after fix |
| `approved` | `takedown` | moderator/admin | Legal/DMCA post-publication removal |

### 3.2 Auto Pre-screen (MVP)

Runs before entering moderation queue:

1. **MIME sniffing**: Verify actual file type matches extension (防伪装可执行文件)
2. **Size limits**: Reject over threshold (e.g., 10MB for images)
3. **Perceptual hash (pHash) deduplication**:
   - Compute pHash on upload
   - Query `works.phash` for Hamming distance < threshold (e.g., 5)
   - If near-duplicate found → reject with "duplicate detected" + link to existing
4. **EXIF stripping**: Remove metadata (privacy + size)

Reuses validation logic from existing `preflight_memes.rs` (format check, dimension extraction).

### 3.3 Audit Trail

Every state transition writes to `moderation_log`:
- `action`: `submit` | `approve` | `reject` | `takedown` | `resubmit`
- `actor_id`: who performed the action
- `note`: rejection reason or takedown justification

---

## 4. Authentication & Roles

### 4.1 Roles

| Role | Permissions |
|------|-------------|
| `anonymous` | Browse `approved` works |
| `member` | Upload works; view own `pending`/`rejected` |
| `moderator` | Access moderation queue; approve/reject/takedown |
| `admin` | User management; role assignment |

### 4.2 Session Management

- Password hashing: **argon2id** (compliant, per CLAUDE.md legal/compliance note)
- Session tokens: Store in httpOnly cookie or Authorization header (Bearer token)
- Token storage: **Do NOT store in localStorage** (XSS risk) — use httpOnly cookies or memory-only

Rust implementation: `tower-http` middleware + `argon2` crate.

---

## 5. Legal & Content Policy

### 5.1 Mandatory Provenance

**Constraint locked** (from user input):
- Meme `origin='derived'` or `'fan_made'` → `source` field required (CHECK enforced)
- Art `gallery='art'` → `source_url` field required (CHECK enforced)

### 5.2 Content Rating

**Art only** (memes do not require rating):
- `all_ages`: Safe for all audiences
- `r15`: Mild suggestive content
- `r18`: Explicit adult content

Frontend must filter by rating based on user account settings (not in scope for Phase 0, noted for later).

### 5.3 Takedown SLA

- `takedown` state available post-publication for legal compliance (DMCA, copyright claims)
- SLA: TBD by operations team (not blocking MVP)

---

## 6. Storage Architecture

### 6.1 Media Paths

| Content | Storage | URL Generation |
|---------|---------|----------------|
| Official memes | Repository `assets/memes/` | `asset_file` → API generates `/media/memes/{filename}` |
| UGC uploads | S3-compatible object storage | Direct object URL → populate `works.file` |

**Key principle**: UGC **never enters git repository**. All user uploads go to object storage, `file` field stores the permanent URL.

### 6.2 Object Storage Integration

Environment variables (new):
- `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY` / `S3_SECRET_KEY`
- `PUBLIC_MEME_MEDIA_BASE_URL` (existing) → also serves as object storage CDN prefix

Rust implementation: `aws-sdk-s3` or `object_store` crate.

---

## 7. Migration from Current State

### 7.1 Schema Migration

Current: SQLite (`memes.sql` seed) → New: Postgres  
Tool: `sqlx migrate` or `refinery` (version-controlled migrations)

**No historical data migration** (per user input):
- Current test data: 3499 activity-record meme screenshots in `tmp/real-memes/`
- Sufficient for development/testing (8000+ was projected max, not actual)
- Fresh start on new schema

### 7.2 Breaking Changes from Current Backend

| Component | Current | New | Impact |
|-----------|---------|-----|--------|
| Cache | `MemeDataCache` (mtime全量reload) | Direct Postgres queries + connection pool | **Must replace** — write-incompatible |
| Data source | SQLite file | Postgres | Migration tool required |
| Facets | Static from catalog | Dynamic queries on `work_*` tables | Refactor `facets.rs` |
| Media | Repository `assets/` only | Repository + object storage | Extend `send_meme_asset` |

### 7.3 What Can Be Preserved

✅ Retain:
- API contract (`GET /api/memes`, `/api/categories`, etc.) — extend, don't break
- Media URL abstraction (`file` / `asset_file` / `PUBLIC_MEME_MEDIA_BASE_URL`)
- Validation logic from `preflight_memes.rs` → reuse in upload pre-screen
- Test suite structure (35 tests in `main.rs` tests module)
- `catalog.rs` normalization patterns (facet aggregation, URI encode/decode)

---

## 8. Next Steps (Phase 1 Inputs)

With Phase 0 locked, **Phase 1 (Backend Spine Refactor)** can proceed with:

1. **Postgres + sqlx setup**: Connection pool, migration framework
2. **Replace `MemeDataCache`**: Write-aware data layer (query + invalidate, not mtime全量reload)
3. **Modularize `main.rs`**: Extract `routes/`, `handlers/`, `auth/`, `upload/`, `storage/`, `cache/`
4. **Auth middleware**: argon2 + session tokens via `tower-http`
5. **Upload pipeline**: Form handler → pre-screen (MIME/size/pHash) → insert `pending` → object storage
6. **Extend facets**: `facets.rs` now queries `work_characters`/`work_tags`/`work_categories` with `gallery` scope

**Estimated complexity**: Refactor (not rewrite). Incremental evolution of existing 3700-line Rust codebase with proven correctness (35 passing tests).

---

## Appendix A: Open Questions (Resolved)

| # | Question | Resolution |
|---|----------|------------|
| 1 | Art metadata fields? | artist, medium, rating, source_url (locked) |
| 2 | Legal: mandatory provenance? | Yes: derived/fan_made → source; art → source_url |
| 3 | pHash dedup in MVP? | Yes |
| 4 | Single table vs core+extension? | Extension tables (locked) |
| 5 | SQLite or Postgres? | Postgres (locked) |
| 6 | Rating tiers? | all_ages / r15 / r18 (locked) |
| 7 | Historical data migration? | No (3499 test items sufficient) |

---

## Appendix B: Out of Scope (Future Phases)

- Frontend gallery switching (meme vs art tabs)
- Moderation UI (queue, approve/reject buttons)
- User registration & login forms
- Rating-based content filtering
- Batch moderation operations
- Full-text search ranking tuning
- CDN integration for object storage
- Rate limiting & abuse prevention

These are deferred to Phase 2+ (implementation phases post-spine).

---

**Sign-off**: This specification is ready for Phase 1 implementation once approved.
