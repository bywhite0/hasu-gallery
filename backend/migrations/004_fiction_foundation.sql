-- Architecture V2 Slice C: Fiction domain foundation tables and compatibility.
-- Depends on 003_fiction_gallery_kind having committed gallery_kind=fiction.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE content_kind AS ENUM ('meme', 'art', 'fiction');
CREATE TYPE content_rating AS ENUM ('all_ages', 'r15', 'r18');
CREATE TYPE fiction_revision_state AS ENUM (
  'draft',
  'pending',
  'published',
  'rejected',
  'withdrawn'
);
CREATE TYPE fiction_completion_state AS ENUM (
  'unknown',
  'ongoing',
  'complete',
  'hiatus'
);

ALTER TABLE works
  ADD COLUMN content_kind content_kind,
  ADD COLUMN content_rating content_rating NOT NULL DEFAULT 'all_ages';

UPDATE works
SET content_kind = CASE gallery::text
  WHEN 'meme' THEN 'meme'::content_kind
  WHEN 'art' THEN 'art'::content_kind
  ELSE content_kind
END
WHERE content_kind IS NULL;

UPDATE works w
SET content_rating = COALESCE(
  (
    SELECT CASE am.rating::text
      WHEN 'all_ages' THEN 'all_ages'::content_rating
      WHEN 'r15' THEN 'r15'::content_rating
      WHEN 'r18' THEN 'r18'::content_rating
      ELSE 'all_ages'::content_rating
    END
    FROM work_art_meta am
    WHERE am.work_id = w.id
  ),
  'all_ages'::content_rating
);

ALTER TABLE works
  ALTER COLUMN content_kind SET NOT NULL,
  ALTER COLUMN content_kind SET DEFAULT 'meme'::content_kind;

-- Replace integrity CHECKs from 001_initial so Fiction can omit image assets.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'works'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) ILIKE '%gallery%origin%'
        OR pg_get_constraintdef(oid) ILIKE '%file IS NOT NULL%'
        OR pg_get_constraintdef(oid) ILIKE '%asset_file IS NOT NULL%'
        OR pg_get_constraintdef(oid) ILIKE '%source <>%'
        OR pg_get_constraintdef(oid) ILIKE '%source_url%'
      )
  LOOP
    EXECUTE format('ALTER TABLE works DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE works
  ADD CONSTRAINT works_gallery_origin_integrity CHECK (
    (gallery = 'meme' AND origin IS NOT NULL) OR
    (gallery = 'art' AND origin IS NULL) OR
    (gallery = 'fiction' AND origin IS NULL)
  ),
  ADD CONSTRAINT works_media_or_fiction CHECK (
    gallery = 'fiction' OR file IS NOT NULL OR asset_file IS NOT NULL
  ),
  ADD CONSTRAINT works_meme_source_required CHECK (
    NOT (origin IN ('derived', 'fan_made')) OR source <> ''
  ),
  ADD CONSTRAINT works_art_source_url_required CHECK (
    gallery <> 'art' OR source_url <> ''
  ),
  ADD CONSTRAINT works_content_kind_matches_gallery CHECK (
    content_kind::text = gallery::text
  );

CREATE TABLE work_fiction_meta (
  work_id TEXT PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'zh-Hans',
  fandom TEXT NOT NULL DEFAULT '',
  synopsis TEXT NOT NULL DEFAULT '',
  content_rating content_rating NOT NULL DEFAULT 'all_ages',
  completion_state fiction_completion_state NOT NULL DEFAULT 'unknown',
  cover_media_id UUID,
  current_published_revision_id UUID,
  word_count INTEGER NOT NULL DEFAULT 0 CHECK (word_count >= 0),
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE fiction_revisions (
  id UUID PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  author_id BIGINT NOT NULL REFERENCES users(id),
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  state fiction_revision_state NOT NULL DEFAULT 'draft',
  title TEXT NOT NULL DEFAULT '',
  markup_source TEXT NOT NULL DEFAULT '',
  plain_text_projection TEXT NOT NULL DEFAULT '',
  content_sha256 TEXT NOT NULL DEFAULT '',
  word_count INTEGER NOT NULL DEFAULT 0 CHECK (word_count >= 0),
  expected_work_version BIGINT,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  UNIQUE (work_id, revision_number)
);

CREATE INDEX idx_fiction_revisions_work_state
  ON fiction_revisions(work_id, state, revision_number DESC);
CREATE INDEX idx_fiction_revisions_author
  ON fiction_revisions(author_id, created_at DESC);

ALTER TABLE work_fiction_meta
  ADD CONSTRAINT work_fiction_meta_current_published_revision_id_fkey
  FOREIGN KEY (current_published_revision_id)
  REFERENCES fiction_revisions(id);

CREATE TABLE fiction_series (
  id UUID PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  synopsis TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE fiction_series_items (
  series_id UUID NOT NULL REFERENCES fiction_series(id) ON DELETE CASCADE,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0),
  PRIMARY KEY (series_id, work_id),
  UNIQUE (series_id, position)
);

CREATE INDEX idx_fiction_series_owner
  ON fiction_series(owner_id, updated_at DESC);
CREATE INDEX idx_work_fiction_meta_rating
  ON work_fiction_meta(content_rating);
CREATE INDEX idx_work_fiction_meta_fandom
  ON work_fiction_meta(fandom);
CREATE INDEX idx_work_fiction_meta_synopsis_trgm
  ON work_fiction_meta USING gin (synopsis gin_trgm_ops);

CREATE TRIGGER work_fiction_meta_updated_at
  BEFORE UPDATE ON work_fiction_meta
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER fiction_series_updated_at
  BEFORE UPDATE ON fiction_series
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
