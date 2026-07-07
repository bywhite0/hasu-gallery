import { useState, FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { Button, Field, FormMessage, Input } from '@hasu-gallery/ui';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../i18n';
import { getAuthErrorMessage, isRecoverableAuthError } from './authErrorCopy';
import type { AuthIntentReason } from './authIntent';

interface RegisterFormProps {
  next?: string;
  reason?: AuthIntentReason;
}

export function RegisterForm({ next, reason }: RegisterFormProps) {
  const { t } = useI18n();
  const { register, clearError } = useAuthStore();
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const clearFormErrors = () => {
    if (validationError) setValidationError('');
    if (submitError) setSubmitError(null);
    clearError();
  };

  const validateForm = (): boolean => {
    if (!handle.trim() || !email.trim() || !password) {
      setValidationError(t('auth.validationRequired'));
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setValidationError(t('auth.validationEmail'));
      return false;
    }

    if (password.length < 8) {
      setValidationError(t('auth.validationPasswordLength'));
      return false;
    }

    setValidationError('');
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await register(handle.trim(), email.trim(), password, displayName.trim() || handle.trim());
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('auth.errorRegisterFallback'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = validationError || getAuthErrorMessage(submitError, 'register', t);
  const canSubmit = Boolean(handle.trim() && email.trim() && password);
  const authSearch = next ? ({ next, reason } as never) : undefined;

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <Field label={t('auth.handle')} htmlFor="handle" required>
        <Input
          id="handle"
          type="text"
          value={handle}
          onChange={(e) => {
            setHandle(e.target.value);
            clearFormErrors();
          }}
          disabled={isSubmitting}
          required
          autoComplete="username"
        />
      </Field>

      <Field label={t('auth.email')} htmlFor="email" required>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearFormErrors();
          }}
          disabled={isSubmitting}
          required
          autoComplete="email"
        />
      </Field>

      <Field label={t('auth.password')} htmlFor="password" required hint={t('auth.passwordHint')}>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearFormErrors();
          }}
          disabled={isSubmitting}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </Field>

      <Field label={t('auth.displayName')} htmlFor="displayName" hint={t('auth.displayNameHint')}>
        <Input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            clearFormErrors();
          }}
          disabled={isSubmitting}
          autoComplete="name"
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
        {isSubmitting ? t('auth.creatingAccount') : t('auth.registerButton')}
      </Button>

      <div className="text-center text-sm text-ink-2">
        {t('auth.hasAccount')}{' '}
        <Link
          to="/login"
          search={authSearch}
          className="font-medium text-ink underline underline-offset-4 hover:text-ink-2"
        >
          {t('auth.loginButton')}
        </Link>
      </div>
    </form>
  );
}
