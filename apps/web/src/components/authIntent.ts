export type AuthIntentReason = 'upload' | 'profile' | 'moderation';

export interface AuthIntentSearch {
  next?: unknown;
  reason?: unknown;
}

export const authIntentCopy: Record<AuthIntentReason, { title: string; description: string }> = {
  upload: {
    title: 'Sign in to upload',
    description: 'Upload is available after sign-in so your submission can enter review under your account.',
  },
  profile: {
    title: 'Sign in to view your uploads',
    description: 'Your profile shows submission status, reviewer notes, and published works tied to your account.',
  },
  moderation: {
    title: 'Reviewer sign-in required',
    description: 'Moderation tools are limited to reviewer accounts.',
  },
};

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
  return value === 'upload' || value === 'profile' || value === 'moderation';
}
