import type { TranslationKey } from '../i18n';

export type AuthIntentReason = 'upload' | 'profile' | 'moderation' | 'fiction';

export interface AuthIntentSearch {
  next?: unknown;
  reason?: unknown;
}

const authIntentCopyKeys: Record<AuthIntentReason, { title: TranslationKey; description: TranslationKey }> = {
  upload: {
    title: 'auth.intentUploadTitle',
    description: 'auth.intentUploadDescription',
  },
  profile: {
    title: 'auth.intentProfileTitle',
    description: 'auth.intentProfileDescription',
  },
  moderation: {
    title: 'auth.intentModerationTitle',
    description: 'auth.intentModerationDescription',
  },
  fiction: {
    title: 'auth.intentFictionTitle',
    description: 'auth.intentFictionDescription',
  },
};

export function getAuthIntentCopy(
  reason: AuthIntentReason,
  t: (key: TranslationKey) => string,
) {
  const copy = authIntentCopyKeys[reason];
  return {
    title: t(copy.title),
    description: t(copy.description),
  };
}

export function getAuthIntent(search: AuthIntentSearch) {
  const next = typeof search.next === 'string' ? sanitizeNextPath(search.next) : undefined;
  const reason = isAuthIntentReason(search.reason) ? search.reason : undefined;

  return { next, reason };
}

export function sanitizeNextPath(value: string) {
  if (!value.startsWith('/') || value.startsWith('//')) return undefined;
  return value;
}

function isAuthIntentReason(value: unknown): value is AuthIntentReason {
  return value === 'upload' || value === 'profile' || value === 'moderation' || value === 'fiction';
}
