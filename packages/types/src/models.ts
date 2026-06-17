// 基础类型定义（按 Phase 0 规范）

export type GalleryKind = 'meme' | 'art';
export type MemeOrigin = 'official' | 'derived' | 'fan_made';
export type WorkStatus = 'pending' | 'approved' | 'rejected' | 'takedown';
export type UserRole = 'member' | 'moderator' | 'admin';
export type ArtRating = 'all_ages' | 'r15' | 'r18';

export interface Work {
  id: string;
  gallery: GalleryKind;
  origin: MemeOrigin | null;
  title: string;
  status: WorkStatus;
  uploader_name: string | null; // 替换 uploader_id，显示上传者昵称
  file: string | null;
  asset_file: string | null;
  thumbnail_url?: string; // 前端显示用，从 asset_file 派生
  file_url?: string; // 前端显示用，从 asset_file 派生
  width: number;
  height: number;
  source: string;
  source_url: string;
  rights_note: string;
  created_at: string;
  updated_at: string;
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
