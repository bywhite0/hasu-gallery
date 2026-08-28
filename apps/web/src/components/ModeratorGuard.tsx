/**
 * ModeratorGuard - Protects routes that require moderator or admin role
 */

import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../i18n';

interface ModeratorGuardProps {
  children: React.ReactNode;
}

export function ModeratorGuard({ children }: ModeratorGuardProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user, isLoading, hasCheckedAuth } = useAuthStore();
  const isModerator = user && (user.role === 'moderator' || user.role === 'admin');

  useEffect(() => {
    if (isLoading || !hasCheckedAuth) {
      return;
    }

    if (!user) {
      // Not logged in, redirect to login
      navigate({ to: '/login' as any });
      return;
    }

    // Check if user is moderator or admin
    if (!isModerator) {
      // Not authorized, redirect to home
      navigate({ to: '/' as any });
    }
  }, [user, isModerator, isLoading, hasCheckedAuth, navigate]);

  if (isLoading || !hasCheckedAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em]" />
          <p className="mt-4 text-sm text-ink-2">{t('auth.permissions')}</p>
        </div>
      </div>
    );
  }

  // Don't render children if not authorized
  if (!isModerator) {
    return null;
  }

  return <>{children}</>;
}
