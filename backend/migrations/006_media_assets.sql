-- Architecture V3 S2: UUIDv4 media identity with private/public object keys.
-- New uploads store originals under private/{media_id}/...; approval copies
-- sanitized objects to public/{media_id}/v{n}/... and flips state to public.

CREATE TYPE media_asset_state AS ENUM ('pending', 'public', 'removed');

CREATE TABLE media_assets (
  id               UUID PRIMARY KEY,
  owner_id         BIGINT NOT NULL REFERENCES users(id),
  state            media_asset_state NOT NULL DEFAULT 'pending',
  mime_type        TEXT NOT NULL,
  original_key     TEXT NOT NULL,
  thumb_key        TEXT NOT NULL,
  public_version   INTEGER NOT NULL DEFAULT 1 CHECK (public_version > 0),
  original_sha256  TEXT,
  width            INTEGER NOT NULL CHECK (width > 0),
  height           INTEGER NOT NULL CHECK (height > 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE works ADD COLUMN media_id UUID REFERENCES media_assets(id);

CREATE INDEX idx_works_media_id ON works(media_id) WHERE media_id IS NOT NULL;
CREATE INDEX idx_media_assets_owner ON media_assets(owner_id);
