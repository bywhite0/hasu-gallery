import { useState, FormEvent } from 'react';
import { Button } from '@hasu-gallery/ui';
import { useAuthStore } from '../store/auth';

export function LoginForm() {
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAuthStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!handle.trim() || !password.trim()) {
      return;
    }

    await login(handle, password);
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="handle" style={{ display: 'block', marginBottom: '0.25rem' }}>
          Handle
        </label>
        <input
          id="handle"
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          required
          disabled={isLoading}
          style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="password" style={{ display: 'block', marginBottom: '0.25rem' }}>
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
          style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
        />
      </div>

      {error && (
        <div style={{ color: 'red', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      <Button type="submit" disabled={isLoading || !handle.trim() || !password.trim()}>
        {isLoading ? 'Logging in...' : 'Login'}
      </Button>

      <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
        Don't have an account?{' '}
        <a href="/register" style={{ color: 'blue', textDecorationLine: 'underline' }}>
          Register
        </a>
      </p>
    </form>
  );
}
