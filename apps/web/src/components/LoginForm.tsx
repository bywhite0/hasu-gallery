import { useState, FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { Button, Field, FormMessage, Input } from '@hasu-gallery/ui';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../i18n';
import { getAuthErrorMessage, isRecoverableAuthError } from './authErrorCopy';
import type { AuthIntentReason } from './authIntent';

interface LoginFormProps {
  next?: string;
  reason?: AuthIntentReason;
}

export function LoginForm({ next, reason }: LoginFormProps) {
  const { t } = useI18n();
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { login, clearError } = useAuthStore();
  const displayError = getAuthErrorMessage(submitError, 'login', t);
  const canSubmit = Boolean(handle.trim() && password.trim());
  const authSearch = next ? ({ next, reason } as never) : undefined;

  const updateHandle = (value: string) => {
    setHandle(value);
    if (submitError) setSubmitError(null);
    clearError();
  };

  const updatePassword = (value: string) => {
    setPassword(value);
    if (submitError) setSubmitError(null);
    clearError();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!canSubmit) {
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await login(handle.trim(), password);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('auth.errorLoginFallback'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label={t('auth.handle')} htmlFor="handle" required>
        <Input
          id="handle"
          type="text"
          value={handle}
          onChange={(e) => updateHandle(e.target.value)}
          required
          disabled={isSubmitting}
          autoComplete="username"
        />
      </Field>

      <Field label={t('auth.password')} htmlFor="password" required>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => updatePassword(e.target.value)}
          required
          disabled={isSubmitting}
          autoComplete="current-password"
        />
      </Field>

      {displayError && (
        <FormMessage
          action={
            isRecoverableAuthError(submitError) ? (
              <Button type="submit" variant="outline" size="sm" disabled={isSubmitting || !canSubmit}>
                {t('common.tryAgain')}
              </Button>
            ) : undefined
          }
        >
          {displayError}
        </FormMessage>
      )}

      <Button type="submit" disabled={isSubmitting || !canSubmit} className="w-full">
        {isSubmitting ? t('auth.loggingIn') : t('auth.loginButton')}
      </Button>

      <p className="text-center text-sm text-ink-2">
        {t('auth.noAccount')}{' '}
        <Link
          to="/register"
          search={authSearch}
          className="font-medium text-ink underline underline-offset-4 hover:text-ink-2"
        >
          {t('auth.registerButton')}
        </Link>
      </p>
    </form>
  );
}
