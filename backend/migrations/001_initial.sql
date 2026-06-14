-- Phase 1.1: Initial database schema
-- Based on Phase 0 spec (.ccg/spec/phase0-content-core-model.md)

-- Enumerations
CREATE TYPE gallery_kind AS ENUM ('meme', 'art');
CREATE TYPE meme_origin AS ENUM ('official', 'derived', 'fan_made');
CREATE TYPE work_status AS ENUM ('pending', 'approved', 'rejected', 'takedown');
CREATE TYPE user_role AS ENUM ('member', 'moderator', 'admin');
CREATE TYPE art_rating AS ENUM ('all_ages', 'r15', 'r18');

-- Users table
CREATE TABLE users (
  id           BIGSERIAL PRIMARY KEY,
  handle       TEXT NOT NULL UNIQUE,
  email        TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role         user_role NOT NULL DEFAULT 'member',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_handle ON users(handle);
CREATE INDEX idx_users_email ON users(email);

-- Core works table
CREATE TABLE works (
  id                   TEXT PRIMARY KEY,
  gallery              gallery_kind NOT NULL,
  origin               meme_origin,
  title                TEXT NOT NULL,
  status               work_status NOT NULL DEFAULT 'pending',
  uploader_id          BIGINT REFERENCES users(id),
  file                 TEXT,
  asset_file           TEXT,
  thumbnail_file       TEXT,
  thumbnail_asset_file TEXT,
  width                INTEGER NOT NULL CHECK (width > 0),
  height               INTEGER NOT NULL CHECK (height > 0),
  source               TEXT NOT NULL DEFAULT '',
  source_url           TEXT NOT NULL DEFAULT '',
  rights_note          TEXT NOT NULL DEFAULT '',
  phash                BIGINT,
  search_tsv           TSVECTOR,
  reviewed_by          BIGINT REFERENCES users(id),
  reviewed_at          TIMESTAMPTZ,
  review_note          TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Integrity constraints
  CHECK ((gallery='meme' AND origin IS NOT NULL) OR (gallery='art' AND origin IS NULL)),
  CHECK ((file IS NOT NULL) OR (asset_file IS NOT NULL)),
  CHECK (NOT (origin IN ('derived','fan_made')) OR source <> ''),
  CHECK (gallery <> 'art' OR source_url <> '')
);

CREATE INDEX idx_works_gallery_status ON works(gallery, status);
CREATE INDEX idx_works_uploader ON works(uploader_id);
CREATE INDEX idx_works_updated_at ON works(updated_at DESC);
CREATE INDEX idx_works_search ON works USING GIN(search_tsv);
CREATE INDEX idx_works_phash ON works(phash) WHERE phash IS NOT NULL;

-- Art-specific metadata (1:1 with art works)
CREATE TABLE work_art_meta (
  work_id TEXT PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
  artist  TEXT NOT NULL,
  medium  TEXT,
  rating  art_rating NOT NULL
);

-- M2M: Characters (shared)
CREATE TABLE work_characters (
  work_id  TEXT REFERENCES works(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  position INTEGER,
  PRIMARY KEY (work_id, name)
);

CREATE INDEX idx_work_characters_work ON work_characters(work_id);
CREATE INDEX idx_work_characters_name ON work_characters(name);

-- M2M: Tags (shared)
CREATE TABLE work_tags (
  work_id  TEXT REFERENCES works(id) ON DELETE CASCADE,
  tag      TEXT NOT NULL,
  position INTEGER,
  PRIMARY KEY (work_id, tag)
);

CREATE INDEX idx_work_tags_work ON work_tags(work_id);
CREATE INDEX idx_work_tags_tag ON work_tags(tag);

-- M2M: Categories (meme-only)
CREATE TABLE work_categories (
  work_id       TEXT REFERENCES works(id) ON DELETE CASCADE,
  category_slug TEXT NOT NULL,
  position      INTEGER,
  PRIMARY KEY (work_id, category_slug)
);

CREATE INDEX idx_work_categories_work ON work_categories(work_id);
CREATE INDEX idx_work_categories_slug ON work_categories(category_slug);

-- Category metadata
CREATE TABLE categories (
  slug       TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  sort_order INTEGER
);

-- Moderation log
CREATE TABLE moderation_log (
  id         BIGSERIAL PRIMARY KEY,
  work_id    TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  actor_id   BIGINT NOT NULL REFERENCES users(id),
  action     TEXT NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_moderation_log_work ON moderation_log(work_id, created_at DESC);
CREATE INDEX idx_moderation_log_actor ON moderation_log(actor_id, created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER works_updated_at
  BEFORE UPDATE ON works
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
