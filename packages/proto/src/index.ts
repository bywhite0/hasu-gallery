/**
 * Architecture V2 Slice A TypeScript surface for hasu.gallery.v2.
 *
 * Full Buf/protobuf-es codegen can replace these mirrors when the generate
 * script is run (`pnpm --filter @hasu-gallery/proto generate`). Until then,
 * keep field names and enum values aligned with proto/hasu/gallery/v2/*.proto.
 */

export const PROTO_MEDIA_TYPE =
  "application/vnd.hasu-gallery.v2+protobuf" as const;

export enum ContentKind {
  UNSPECIFIED = 0,
  MEME = 1,
  ART = 2,
  FICTION = 3,
}

export enum ContentRating {
  UNSPECIFIED = 0,
  ALL_AGES = 1,
  R15 = 2,
  R18 = 3,
}

export interface FieldViolation {
  field: string;
  description: string;
  reason: string;
}

export interface ErrorResponse {
  code: string;
  messageKey: string;
  message: string;
  requestId: string;
  fieldViolations: FieldViolation[];
}

export interface HealthResponse {
  status: string;
  version: string;
  api: string;
}

export interface PublicFictionSummary {
  id: string;
  title: string;
  summary: string;
  contentKind: ContentKind;
  contentRating: ContentRating;
  coverMediaId: string;
  authorHandle: string;
}

export interface PublicFictionDetail {
  id: string;
  title: string;
  summary: string;
  body: string;
  contentKind: ContentKind;
  contentRating: ContentRating;
  coverMediaId: string;
  authorHandle: string;
  publishedAt: string;
}

export interface OwnerFictionDraft {
  id: string;
  fictionId: string;
  title: string;
  body: string;
  contentRating: ContentRating;
  updatedAt: string;
}

export interface FictionRevision {
  id: string;
  fictionId: string;
  title: string;
  body: string;
  revisionNumber: number;
  contentRating: ContentRating;
  status: string;
  createdAt: string;
}

export interface FictionSeries {
  id: string;
  title: string;
  description: string;
  contentRating: ContentRating;
  authorHandle: string;
}

export enum GalleryKind {
  UNSPECIFIED = 0,
  MEME = 1,
  ART = 2,
}

export enum WorkStatus {
  UNSPECIFIED = 0,
  PENDING = 1,
  APPROVED = 2,
  REJECTED = 3,
  TAKEDOWN = 4,
}

export enum MemeOrigin {
  UNSPECIFIED = 0,
  OFFICIAL = 1,
  DERIVED = 2,
  FAN_MADE = 3,
}

export interface PublicUserSummary {
  handle: string;
  displayName: string;
  joinedAt: string;
  approvedPublicWorkCount: number;
}

export interface PublicArtMeta {
  artist: string;
  medium: string;
  contentRating: ContentRating;
}

export interface PublicWork {
  id: string;
  gallery: GalleryKind;
  origin: MemeOrigin;
  title: string;
  status: WorkStatus;
  thumbnailUrl: string;
  fileUrl: string;
  width: number;
  height: number;
  createdAt: string;
  uploaderName: string;
  uploader?: PublicUserSummary;
  source: string;
  sourceUrl: string;
  rightsNote: string;
  artMeta?: PublicArtMeta;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PublicWorksResponse {
  works: PublicWork[];
  pagination?: Pagination;
}

export interface FacetItem {
  value: string;
  label: string;
  count: number;
}

export interface PublicArtFacetsResponse {
  artists: FacetItem[];
  media: FacetItem[];
  ratings: FacetItem[];
}
