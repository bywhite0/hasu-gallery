-- Phase 5.2: query-path indexes for gallery browsing and moderation queues

-- Public gallery and moderation queue queries filter by gallery/status and
-- then order by created_at. One composite index supports both DESC gallery
-- browsing and reverse scans for ASC moderation queues.
CREATE INDEX IF NOT EXISTS idx_works_gallery_status_created_at
  ON works(gallery, status, created_at DESC);

-- Title sorting on the public works list uses the same gallery/status prefix.
CREATE INDEX IF NOT EXISTS idx_works_gallery_status_title
  ON works(gallery, status, title ASC);

-- Profile pages filter by uploader and order by newest submissions.
CREATE INDEX IF NOT EXISTS idx_works_uploader_created_at
  ON works(uploader_id, created_at DESC);

-- Art facets and rating filters join through work_art_meta.
CREATE INDEX IF NOT EXISTS idx_work_art_meta_rating_work
  ON work_art_meta(rating, work_id);

CREATE INDEX IF NOT EXISTS idx_work_art_meta_artist
  ON work_art_meta(artist);

CREATE INDEX IF NOT EXISTS idx_work_art_meta_medium
  ON work_art_meta(medium)
  WHERE medium IS NOT NULL;
