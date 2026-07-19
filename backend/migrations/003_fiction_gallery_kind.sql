-- Architecture V2 Slice C: commit gallery_kind=fiction before use.
-- PostgreSQL requires ADD VALUE to be committed before the new label can be
-- referenced by CHECK constraints, inserts, or casts in a later transaction.

ALTER TYPE gallery_kind ADD VALUE IF NOT EXISTS 'fiction';
