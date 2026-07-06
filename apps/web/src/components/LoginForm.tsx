import { useState, FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { Button, Field, FormMessage, Input } from '@hasu-gallery/ui';
import { useAuthStore } from '../store/auth';
import { getAuthErrorMessage, isRecoverableAuthError } from './authErrorCopy';

export function LoginForm() {
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { login, clearError } = useAuthStore();
  const displayError = getAuthErrorMessage(submitError, 'login');
  const canSubmit = Boolean(handle.trim() && password.trim());

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
      setSubmitError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Handle" htmlFor="handle" required>
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

      <Field label="Password" htmlFor="password" required>
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
                Try again
              </Button>
            ) : undefined
          }
        >
          {displayError}
        </FormMessage>
      )}

      <Button type="submit" disabled={isSubmitting || !canSubmit} className="w-full">
        {isSubmitting ? 'Logging in...' : 'Login'}
      </Button>

      <p className="text-center text-sm text-ink-2">
        Don't have an account?{' '}
        <Link to="/register" className="font-medium text-ink underline underline-offset-4 hover:text-ink-2">
          Register
        </Link>
      </p>
    </form>
  );
}
