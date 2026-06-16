import { fetchJson } from './client';
import type { User } from '@hasu-gallery/types';

interface LoginRequest {
  handle: string;
  password: string;
}

interface RegisterRequest {
  handle: string;
  email: string;
  password: string;
  display_name?: string;
}

/**
 * Login with handle and password
 */
export async function login(req: LoginRequest): Promise<User> {
  return fetchJson<User>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

/**
 * Register a new user account
 */
export async function register(req: RegisterRequest): Promise<User> {
  return fetchJson<User>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

/**
 * Logout current user
 */
export async function logout(): Promise<void> {
  await fetchJson<void>('/api/auth/logout', {
    method: 'POST',
  });
}

/**
 * Get current authenticated user
 */
export async function me(): Promise<User | null> {
  try {
    return await fetchJson<User>('/api/auth/me');
  } catch (error) {
    // 401 means not authenticated - return null instead of throwing
    if (error instanceof Error && error.message.includes('401')) {
      return null;
    }
    throw error;
  }
}
