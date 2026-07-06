import { useState, FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { Button, Field, FormMessage, Input } from '@hasu-gallery/ui';
import { useAuthStore } from '../store/auth';
import { getAuthErrorMessage, isRecoverableAuthError } from './authErrorCopy';

export function RegisterForm() {
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
      setValidationError('Handle, email, and password are required.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setValidationError('Enter a valid email address.');
      return false;
    }

    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters.');
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
      setSubmitError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = validationError || getAuthErrorMessage(submitError, 'register');
  const canSubmit = Boolean(handle.trim() && email.trim() && password);

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <Field label="Handle" htmlFor="handle" required>
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

      <Field label="Email" htmlFor="email" required>
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

      <Field label="Password" htmlFor="password" required hint="Use at least 8 characters.">
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

      <Field label="Display name" htmlFor="displayName" hint="Defaults to your handle.">
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
                Try again
              </Button>
            ) : undefined
          }
        >
          {displayError}
        </FormMessage>
      )}

      <Button type="submit" disabled={isSubmitting || !canSubmit} className="w-full">
        {isSubmitting ? 'Creating account...' : 'Register'}
      </Button>

      <div className="text-center text-sm text-ink-2">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-ink underline underline-offset-4 hover:text-ink-2">
          Login
        </Link>
      </div>
    </form>
  );
}
