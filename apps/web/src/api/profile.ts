import { fetchJson } from './client';
import type { WorkStatus, WorksListResponse } from '@hasu-gallery/types';

export interface MyWorksParams {
  status?: WorkStatus;
  page?: number;
  limit?: number;
}

export interface UserStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  takedown: number;
}

export async function getMyWorks(params: MyWorksParams = {}): Promise<WorksListResponse> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

  const query = searchParams.toString();
  return fetchJson<WorksListResponse>(`/api/users/me/works${query ? '?' + query : ''}`);
}

export async function getMyStats(): Promise<UserStats> {
  return fetchJson<UserStats>('/api/users/me/stats');
}
