// API 响应类型

import { Work, GalleryKind, MemeOrigin, WorkStatus } from './models';

export interface WorkListItem {
  id: string;
  gallery: GalleryKind;
  origin: MemeOrigin | null;
  title: string;
  status: WorkStatus;
  thumbnail_url: string;
  file_url: string;
  width: number;
  height: number;
  created_at: string;
}

export interface WorksListResponse {
  works: WorkListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface WorkDetailResponse {
  work: Work;
}

export interface FacetResponse {
  name: string;
  count: number;
}

export interface CategoriesResponse {
  categories: Array<{
    slug: string;
    label: string;
    count: number;
  }>;
}

export interface CharactersResponse {
  characters: FacetResponse[];
}

export interface TagsResponse {
  tags: FacetResponse[];
}
