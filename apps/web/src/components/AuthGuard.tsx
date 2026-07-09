import type { ReactNode } from 'react';
import { Navigate, useRouterState } from '@tanstack/react-router';
import { StateMessage } from '@hasu-gallery/ui';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../i18n';
import type { AuthIntentReason } from './authIntent';

interface AuthGuardProps {
  children: ReactNode;
  reason?: AuthIntentReason;
  next?: string;
}

export function AuthGuard({ children, reason, next }: AuthGuardProps) {
  const { t } = useI18n();
  const { user, isLoading, hasCheckedAuth } = useAuthStore();
  const currentPath = useRouterState({ select: (state) => state.location.pathname });
  const nextPath = next ?? currentPath;

  if (isLoading || !hasCheckedAuth) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <StateMessage
          title={t('auth.checkingTitle')}
          tone="info"
        />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" search={{ next: nextPath, reason } as never} />;
  }

  return <>{children}</>;
}
