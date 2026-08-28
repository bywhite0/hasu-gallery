// Fiction API 契约类型（Architecture V3 单一 JSON 契约）

export type ContentRating = 'all_ages' | 'r15' | 'r18';

export type FictionRevisionState =
  | 'draft'
  | 'pending'
  | 'published'
  | 'rejected'
  | 'withdrawn';

export interface PublicFictionSummary {
  id: string;
  title: string;
  summary: string;
  content_rating: ContentRating;
  cover_media_id: string | null;
  author_handle: string;
  fandom: string;
  language: string;
  word_count: number;
  published_revision_id: string;
}

export interface PublicFictionListResponse {
  items: PublicFictionSummary[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PublicFictionDetail {
  id: string;
  title: string;
  summary: string;
  body: string;
  content_rating: ContentRating;
  cover_media_id: string | null;
  author_handle: string;
  published_at: string | null;
  fandom: string;
  language: string;
  word_count: number;
  published_revision_id: string;
  content_sha256: string;
}

export interface OwnerFictionDraft {
  id: string;
  fiction_id: string;
  title: string;
  body: string;
  content_rating: ContentRating;
  updated_at: string | null;
  state: string;
  revision_number: number;
  work_version: number;
  synopsis: string;
  fandom: string;
  language: string;
}

export interface OwnerFictionListResponse {
  items: OwnerFictionDraft[];
}

export interface FictionRevision {
  id: string;
  fiction_id: string;
  title: string;
  body: string;
  revision_number: number;
  content_rating: ContentRating;
  status: string;
  created_at: string | null;
  plain_text_excerpt: string;
  word_count: number;
}

export interface ModerationFictionQueueResponse {
  items: FictionRevision[];
}

export interface FictionRevisionWriteResponse {
  work_id: string;
  revision_id: string;
  revision_number: number;
  word_count: number;
}

export interface SubmitFictionResponse {
  revision_id: string;
  state: string;
}

export interface FictionDecisionResponse {
  work_id: string;
  revision_id: string;
  state: string;
}

export interface FictionErrorResponse {
  code: string;
  message: string;
}
