import type { ReactNode } from 'react';
import { StateMessage } from '@hasu-gallery/ui';
import { getAuthIntentCopy, type AuthIntentReason } from './authIntent';
import { useI18n } from '../i18n';

interface AuthLayoutProps {
  title: string;
  reason?: AuthIntentReason;
  children: ReactNode;
}

export function AuthLayout({ title, reason, children }: AuthLayoutProps) {
  const { t } = useI18n();
  const intentCopy = reason ? getAuthIntentCopy(reason, t) : undefined;

  return (
    <div className="flex min-h-[calc(100vh-6rem)] items-start justify-center py-10 text-ink sm:items-center sm:py-16">
      <div className="mx-auto w-full max-w-md space-y-4">
        {intentCopy && (
          <StateMessage
            title={intentCopy.title}
            tone="info"
            className="min-h-0 px-4 py-3"
          />
        )}
        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-6">
          <h1 className="mb-6 text-center text-2xl font-semibold">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}
