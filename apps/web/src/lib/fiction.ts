import { ContentRating } from '@hasu-gallery/proto';
import type { TranslationKey } from '../i18n';
import { ProtobufApiError } from '../api/protobuf';

export type FictionState = 'draft' | 'pending' | 'published' | 'rejected' | 'withdrawn';

export const fictionStateKeys = {
  draft: 'fictionState.draft',
  pending: 'fictionState.pending',
  published: 'fictionState.published',
  rejected: 'fictionState.rejected',
  withdrawn: 'fictionState.withdrawn',
} as const satisfies Record<FictionState, TranslationKey>;

export function isFictionState(value: string): value is FictionState {
  return value in fictionStateKeys;
}

export function contentRatingValue(rating: ContentRating) {
  switch (rating) {
    case ContentRating.ALL_AGES:
      return 'all_ages';
    case ContentRating.R15:
      return 'r15';
    case ContentRating.R18:
      return 'r18';
    default:
      return 'all_ages';
  }
}

export function toSafeNumber(value: bigint) {
  const maximum = BigInt(Number.MAX_SAFE_INTEGER);
  return Number(value > maximum ? maximum : value);
}

export function fictionErrorKey(error: unknown, fallback: TranslationKey): TranslationKey {
  if (error instanceof ProtobufApiError) {
    if (error.code === 'not_found') return 'fiction.errorNotFound';
    if (error.code === 'version_conflict') return 'fictionWorkspace.errorVersionConflict';
    if (error.code === 'pending_exists') return 'fictionWorkspace.errorPendingExists';
    if (error.code === 'invalid_response_media_type' || error.code === 'invalid_protobuf_response') {
      return 'fiction.errorProtocol';
    }
  }

  if (error instanceof TypeError || (error instanceof Error && error.message === 'Failed to fetch')) {
    return 'fiction.errorNetwork';
  }

  return fallback;
}
