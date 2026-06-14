// API 响应类型

import { Work } from './models';

export interface WorksListResponse {
  works: Work[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
  limit: number;
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
