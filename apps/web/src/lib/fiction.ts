import type { TranslationKey } from '../i18n';
import { ApiError } from '../api/client';

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

function apiErrorCode(error: ApiError): string | undefined {
  if (error.data && typeof error.data === 'object' && 'code' in error.data) {
    const code = (error.data as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

export function fictionErrorKey(error: unknown, fallback: TranslationKey): TranslationKey {
  if (error instanceof ApiError) {
    const code = apiErrorCode(error);
    if (code === 'not_found') return 'fiction.errorNotFound';
    if (code === 'version_conflict') return 'fictionWorkspace.errorVersionConflict';
    if (code === 'pending_exists') return 'fictionWorkspace.errorPendingExists';
  }

  if (error instanceof TypeError || (error instanceof Error && error.message === 'Failed to fetch')) {
    return 'fiction.errorNetwork';
  }

  return fallback;
}
