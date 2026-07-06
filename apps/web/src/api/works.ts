import { fetchJson } from './client';
import { WorksFacetsResponse, WorksListResponse, Work } from '@hasu-gallery/types';

export interface WorksListParams {
  gallery: 'meme' | 'art';
  status?: 'pending' | 'approved' | 'rejected' | 'takedown';
  origin?: 'official' | 'derived' | 'fan_made';
  page?: number;
  limit?: number;
  sort?: 'created_at_desc' | 'created_at_asc' | 'title_asc';
  rating?: 'all_ages' | 'r15' | 'r18';
  artist?: string;
  medium?: string;
}

export interface WorksFacetsParams {
  gallery: 'art';
  status?: 'pending' | 'approved' | 'rejected' | 'takedown';
}

export async function listWorks(params: WorksListParams): Promise<WorksListResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('gallery', params.gallery);
  if (params.status) searchParams.set('status', params.status);
  if (params.origin) searchParams.set('origin', params.origin);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.rating) searchParams.set('rating', params.rating);
  if (params.artist) searchParams.set('artist', params.artist);
  if (params.medium) searchParams.set('medium', params.medium);

  return fetchJson<WorksListResponse>(`/api/works?${searchParams}`);
}

export async function listWorkFacets(
  params: WorksFacetsParams,
): Promise<WorksFacetsResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('gallery', params.gallery);
  if (params.status) searchParams.set('status', params.status);

  return fetchJson<WorksFacetsResponse>(`/api/works/facets?${searchParams}`);
}

export async function getWork(id: string): Promise<Work> {
  return fetchJson<Work>(`/api/works/${id}`);
}
