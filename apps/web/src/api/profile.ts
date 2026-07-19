import { fetchJson } from './client';
import type { WorkStatus, WorksListResponse } from '@hasu-gallery/types';

export type MyWorksGalleryFamily = 'image' | 'fiction' | 'meme' | 'art';

export interface MyWorksParams {
  status?: WorkStatus;
  gallery?: MyWorksGalleryFamily;
  page?: number;
  limit?: number;
}

export interface UserStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  takedown: number;
  image_total: number;
  image_pending: number;
  image_approved: number;
  image_rejected: number;
  image_takedown: number;
  fiction_total: number;
  fiction_pending: number;
  fiction_approved: number;
  fiction_rejected: number;
  fiction_takedown: number;
}

export async function getMyWorks(params: MyWorksParams = {}): Promise<WorksListResponse> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.gallery) searchParams.set('gallery', params.gallery);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

  const query = searchParams.toString();
  return fetchJson<WorksListResponse>(`/api/users/me/works${query ? '?' + query : ''}`);
}

export async function getMyStats(): Promise<UserStats> {
  return fetchJson<UserStats>('/api/users/me/stats');
}
