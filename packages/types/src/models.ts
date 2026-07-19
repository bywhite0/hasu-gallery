// 基础类型定义（按 Phase 0 规范）

export type GalleryKind = 'meme' | 'art' | 'fiction';
export type MemeOrigin = 'official' | 'derived' | 'fan_made';
export type WorkStatus = 'pending' | 'approved' | 'rejected' | 'takedown';
export type UserRole = 'member' | 'moderator' | 'admin';
export type ArtRating = 'all_ages' | 'r15' | 'r18';

export interface ArtMeta {
  artist: string;
  medium?: string | null;
  rating: ArtRating;
}

export interface PublicUserSummary {
  handle: string;
  display_name: string | null;
  joined_at: string | null;
  approved_public_work_count: number;
}

export interface Work {
  id: string;
  gallery: GalleryKind;
  origin: MemeOrigin | null;
  title: string;
  status: WorkStatus;
  uploader_name: string | null;
  uploader?: PublicUserSummary | null;
  file: string | null;
  asset_file: string | null;
  thumbnail_url?: string;
  file_url?: string;
  width: number;
  height: number;
  source: string;
  source_url: string;
  rights_note: string;
  created_at: string;
  updated_at: string;
  art_meta?: ArtMeta | null;
}

export interface User {
  id: number;
  handle: string;
  email: string;
  display_name: string;
  role: UserRole;
  created_at: string;
}

export interface Category {
  slug: string;
  label: string;
  gallery: GalleryKind;
}

export interface Character {
  name: string;
  sort_order: number;
}
