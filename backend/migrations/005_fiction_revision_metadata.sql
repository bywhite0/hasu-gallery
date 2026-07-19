-- Isolate Fiction replacement revisions from the currently published metadata.
-- Metadata is reviewed as part of an immutable revision snapshot and copied to
-- the public work projection only when that revision is approved.

ALTER TABLE fiction_revisions
  ADD COLUMN synopsis TEXT NOT NULL DEFAULT '',
  ADD COLUMN fandom TEXT NOT NULL DEFAULT '',
  ADD COLUMN language TEXT NOT NULL DEFAULT 'zh-Hans',
  ADD COLUMN content_rating content_rating NOT NULL DEFAULT 'all_ages'::content_rating;

UPDATE fiction_revisions r
SET
  synopsis = m.synopsis,
  fandom = m.fandom,
  language = m.language,
  content_rating = m.content_rating
FROM work_fiction_meta m
WHERE m.work_id = r.work_id;
