import { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { StateMessage } from '@hasu-gallery/ui';
import { useI18n } from '../i18n';
import { getAuthIntentCopy, type AuthIntentReason } from './authIntent';

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
            description={intentCopy.description}
            tone="info"
            className="min-h-0 px-4 py-4"
          />
        )}
        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-6">
          <h1 className="mb-6 text-center text-2xl font-semibold">{title}</h1>
          {children}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link to="/gallery/meme" className="font-medium text-ink underline underline-offset-4 hover:text-ink-2">
            {t('auth.continueMeme')}
          </Link>
          <Link to="/gallery/art" className="font-medium text-ink underline underline-offset-4 hover:text-ink-2">
            {t('auth.continueArt')}
          </Link>
          <Link to="/fiction" className="font-medium text-ink underline underline-offset-4 hover:text-ink-2">
            {t('auth.continueFiction')}
          </Link>
        </div>
      </div>
    </div>
  );
}
