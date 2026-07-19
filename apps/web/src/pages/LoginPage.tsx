import { useEffect } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useAuthStore } from '../store/auth';
import { AuthLayout } from '../components/AuthLayout';
import { LoginForm } from '../components/LoginForm';
import { getAuthIntent, type AuthIntentSearch } from '../components/authIntent';
import { useI18n } from '../i18n';

export function LoginPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { t } = useI18n();
  const search = useRouterState({ select: (state) => state.location.search }) as AuthIntentSearch;
  const { next, reason } = getAuthIntent(search);

  useEffect(() => {
    if (user) {
      navigate({ to: (next ?? '/gallery/meme') as never });
    }
  }, [user, navigate, next]);

  return (
    <AuthLayout title={t('auth.loginTitle')} reason={reason}>
      <LoginForm next={next} reason={reason} />
    </AuthLayout>
  );
}
