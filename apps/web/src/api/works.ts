import { fetchJson } from './client';
import { WorksListResponse } from '@hasu-gallery/types';

export interface WorksListParams {
  gallery: 'meme' | 'art';
  status?: 'pending' | 'approved' | 'rejected';
  origin?: 'official' | 'derived' | 'fan_made';
  page?: number;
  limit?: number;
  sort?: 'created_at_desc' | 'created_at_asc' | 'title_asc';
}

export async function listWorks(params: WorksListParams): Promise<WorksListResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('gallery', params.gallery);
  if (params.status) searchParams.set('status', params.status);
  if (params.origin) searchParams.set('origin', params.origin);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.sort) searchParams.set('sort', params.sort);

  return fetchJson<WorksListResponse>(`/api/works?${searchParams}`);
}
