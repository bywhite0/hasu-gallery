/**
 * Moderation API client
 * APIs for moderators to review pending works
 */

import { fetchJson } from './client';

export interface QueueWorkItem {
  id: string;
  title: string;
  gallery: string;
  status: string;
  uploader_handle: string;
  thumbnail_url?: string;
  file_url?: string;
  origin?: string;
  source?: string;
  source_url?: string;
  created_at: string;
  dimensions?: string;
  file_size_bytes?: number;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface QueueResponse {
  works: QueueWorkItem[];
  pagination: Pagination;
}

export interface UpdateStatusRequest {
  status: 'approved' | 'rejected' | 'takedown';
  note?: string;
}

export interface UpdateStatusResponse {
  id: string;
  status: string;
  updated_at: string;
}

export interface ModerationLogEntry {
  id: number;
  action: string;
  moderator_handle: string;
  note?: string;
  created_at: string;
}

export interface ModerationLogResponse {
  work_id: string;
  logs: ModerationLogEntry[];
}

/**
 * Get moderation queue
 */
export async function getModerationQueue(params: {
  gallery: 'meme' | 'art';
  status?: string;
  page?: number;
  limit?: number;
}): Promise<QueueResponse> {
  const queryParams = new URLSearchParams({
    gallery: params.gallery,
    status: params.status || 'pending',
    page: String(params.page || 1),
    limit: String(params.limit || 20),
  });

  return fetchJson<QueueResponse>(`/api/moderation/queue?${queryParams}`);
}

/**
 * Update work status
 */
export async function updateWorkStatus(
  workId: string,
  request: UpdateStatusRequest
): Promise<UpdateStatusResponse> {
  return fetchJson<UpdateStatusResponse>(`/api/works/${workId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(request),
  });
}

/**
 * Get moderation log for a work
 */
export async function getModerationLog(workId: string): Promise<ModerationLogResponse> {
  return fetchJson<ModerationLogResponse>(`/api/moderation/log/${workId}`);
}
