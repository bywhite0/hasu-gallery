import type {
  FictionDecisionResponse,
  FictionRevision,
  FictionRevisionWriteResponse,
  ModerationFictionQueueResponse,
  OwnerFictionDraft,
  OwnerFictionListResponse,
  PublicFictionDetail,
  PublicFictionListResponse,
  PublicFictionSummary,
  SubmitFictionResponse,
} from '@hasu-gallery/types';
import { fetchJson } from './client';

export interface PublicFictionListParams {
  page?: number;
  limit?: number;
  query?: string;
  fandom?: string;
}

export interface CreateFictionInput {
  title: string;
  synopsis: string;
  fandom: string;
  language: string;
  content_rating: string;
  body: string;
}

export interface SaveFictionDraftInput {
  title: string;
  synopsis: string;
  fandom: string;
  content_rating: string;
  body: string;
}

export async function listPublicFictions(params: PublicFictionListParams = {}) {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));
  if (params.query?.trim()) search.set('q', params.query.trim());
  if (params.fandom?.trim()) search.set('fandom', params.fandom.trim());
  const query = search.toString();

  return fetchJson<PublicFictionListResponse>(
    `/api/fictions${query ? `?${query}` : ''}`,
    { credentials: 'omit' },
  );
}

export async function getPublicFiction(id: string): Promise<PublicFictionDetail> {
  return fetchJson<PublicFictionDetail>(`/api/fictions/${encodeURIComponent(id)}`, {
    credentials: 'omit',
  });
}

export async function listOwnerFictions(): Promise<OwnerFictionDraft[]> {
  const response = await fetchJson<OwnerFictionListResponse>('/api/users/me/fictions');
  return response.items;
}

export async function createFiction(input: CreateFictionInput) {
  return fetchJson<FictionRevisionWriteResponse>('/api/users/me/fictions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function saveFictionDraft(workId: string, input: SaveFictionDraftInput) {
  return fetchJson<FictionRevisionWriteResponse>(
    `/api/users/me/fictions/${encodeURIComponent(workId)}/draft`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export async function submitFiction(workId: string, expectedWorkVersion: number) {
  return fetchJson<SubmitFictionResponse>(
    `/api/users/me/fictions/${encodeURIComponent(workId)}/submit`,
    {
      method: 'POST',
      body: JSON.stringify({ expected_work_version: expectedWorkVersion }),
    },
  );
}

export async function listFictionModerationQueue(): Promise<FictionRevision[]> {
  const response = await fetchJson<ModerationFictionQueueResponse>('/api/moderation/fictions');
  return response.items;
}

export async function decideFictionRevision(
  workId: string,
  revisionId: string,
  approve: boolean,
  note: string,
) {
  return fetchJson<FictionDecisionResponse>(
    `/api/moderation/fictions/${encodeURIComponent(workId)}/revisions/${encodeURIComponent(revisionId)}/decision`,
    {
      method: 'POST',
      body: JSON.stringify({ decision: approve ? 'approve' : 'reject', note }),
    },
  );
}

export type { FictionRevision, OwnerFictionDraft, PublicFictionSummary };
