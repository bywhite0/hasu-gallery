/**
 * ModeratorGuard - Protects routes that require moderator or admin role
 */

import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '../store/auth';

interface ModeratorGuardProps {
  children: React.ReactNode;
}

export function ModeratorGuard({ children }: ModeratorGuardProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!user) {
      // Not logged in, redirect to login
      navigate({ to: '/login' as any });
      return;
    }

    // Check if user is moderator or admin
    if (user.role !== 'moderator' && user.role !== 'admin') {
      // Not authorized, redirect to home
      navigate({ to: '/' as any });
    }
  }, [user, navigate]);

  // Don't render children if not authorized
  if (!user || (user.role !== 'moderator' && user.role !== 'admin')) {
    return null;
  }

  return <>{children}</>;
}
