import {
  ContentRating,
  CreateFictionRequestSchema,
  CreateFictionResponseSchema,
  FictionDecisionRequestSchema,
  FictionDecisionResponseSchema,
  FictionDecision,
  ModerationFictionQueueResponseSchema,
  OwnerFictionListResponseSchema,
  PublicFictionDetailSchema,
  PublicFictionListResponseSchema,
  SaveFictionDraftRequestSchema,
  SaveFictionDraftResponseSchema,
  SubmitFictionRequestSchema,
  SubmitFictionResponseSchema,
  type FictionRevision,
  type OwnerFictionDraft,
  type PublicFictionDetail,
  type PublicFictionSummary,
} from '@hasu-gallery/proto';
import { fetchProtobuf, protobufCommand } from './protobuf';

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
  contentRating: ContentRating;
  body: string;
}

export interface SaveFictionDraftInput {
  title: string;
  synopsis: string;
  fandom: string;
  contentRating: ContentRating;
  body: string;
}

export async function listPublicFictions(params: PublicFictionListParams = {}) {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));
  if (params.query?.trim()) search.set('q', params.query.trim());
  if (params.fandom?.trim()) search.set('fandom', params.fandom.trim());
  const query = search.toString();

  return fetchProtobuf(
    `/api/v2/public/fictions${query ? `?${query}` : ''}`,
    PublicFictionListResponseSchema,
    { credentials: 'omit' },
  );
}

export async function getPublicFiction(id: string): Promise<PublicFictionDetail> {
  return fetchProtobuf(
    `/api/v2/public/fictions/${encodeURIComponent(id)}`,
    PublicFictionDetailSchema,
    { credentials: 'omit' },
  );
}

export async function listOwnerFictions(): Promise<OwnerFictionDraft[]> {
  const response = await fetchProtobuf(
    '/api/v2/account/fictions',
    OwnerFictionListResponseSchema,
  );
  return response.items;
}

export async function createFiction(input: CreateFictionInput) {
  return fetchProtobuf(
    '/api/v2/account/fictions',
    CreateFictionResponseSchema,
    {
      method: 'POST',
      ...protobufCommand(CreateFictionRequestSchema, input),
    },
  );
}

export async function saveFictionDraft(workId: string, input: SaveFictionDraftInput) {
  return fetchProtobuf(
    `/api/v2/account/fictions/${encodeURIComponent(workId)}/draft`,
    SaveFictionDraftResponseSchema,
    {
      method: 'PUT',
      ...protobufCommand(SaveFictionDraftRequestSchema, input),
    },
  );
}

export async function submitFiction(workId: string, expectedWorkVersion: bigint) {
  return fetchProtobuf(
    `/api/v2/account/fictions/${encodeURIComponent(workId)}/submit`,
    SubmitFictionResponseSchema,
    {
      method: 'POST',
      ...protobufCommand(SubmitFictionRequestSchema, { expectedWorkVersion }),
    },
  );
}

export async function listFictionModerationQueue(): Promise<FictionRevision[]> {
  const response = await fetchProtobuf(
    '/api/v2/moderation/fictions',
    ModerationFictionQueueResponseSchema,
  );
  return response.items;
}

export async function decideFictionRevision(
  workId: string,
  revisionId: string,
  approve: boolean,
  note: string,
) {
  return fetchProtobuf(
    `/api/v2/moderation/fictions/${encodeURIComponent(workId)}/revisions/${encodeURIComponent(revisionId)}/decision`,
    FictionDecisionResponseSchema,
    {
      method: 'POST',
      ...protobufCommand(FictionDecisionRequestSchema, {
        decision: approve ? FictionDecision.APPROVE : FictionDecision.REJECT,
        note,
      }),
    },
  );
}

export type { FictionRevision, OwnerFictionDraft, PublicFictionSummary };
