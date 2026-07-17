import { create } from 'zustand';
import type { User } from '@hasu-gallery/types';
import { login as apiLogin, register as apiRegister, logout as apiLogout, me as apiMe } from '../api/auth';
import { queryClient } from '../lib/queryClient';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  hasCheckedAuth: boolean;
  error: string | null;
  login: (handle: string, password: string) => Promise<void>;
  register: (handle: string, email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

let authMutationVersion = 0;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  hasCheckedAuth: false,
  error: null,

  login: async (handle: string, password: string) => {
    authMutationVersion += 1;
    set({ isLoading: true, error: null });
    try {
      const user = await apiLogin({ handle, password });
      set({ user, isLoading: false, hasCheckedAuth: true });
      queryClient.clear();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      set({ error: errorMessage, isLoading: false, hasCheckedAuth: true });
      throw err;
    }
  },

  register: async (handle: string, email: string, password: string, displayName?: string) => {
    authMutationVersion += 1;
    set({ isLoading: true, error: null });
    try {
      const user = await apiRegister({ handle, email, password, display_name: displayName });
      set({ user, isLoading: false, hasCheckedAuth: true });
      queryClient.clear();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      set({ error: errorMessage, isLoading: false, hasCheckedAuth: true });
      throw err;
    }
  },

  logout: async () => {
    authMutationVersion += 1;
    set({ isLoading: true, error: null });
    try {
      await apiLogout();
      set({ user: null, isLoading: false, hasCheckedAuth: true });
      queryClient.clear();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Logout failed';
      set({ error: errorMessage, isLoading: false, hasCheckedAuth: true });
      throw err;
    }
  },

  checkAuth: async () => {
    if (get().isLoading) return;

    const checkVersion = authMutationVersion;
    set({ isLoading: true, error: null });
    try {
      const user = await apiMe();
      if (checkVersion !== authMutationVersion) return;
      set({ user, isLoading: false, hasCheckedAuth: true });
    } catch (err) {
      if (checkVersion !== authMutationVersion) return;
      // Keep the current user on transient server/network failures. A real
      // unauthenticated response is represented by apiMe() returning null.
      const errorMessage = err instanceof Error ? err.message : 'Authentication check failed';
      set({ isLoading: false, hasCheckedAuth: true, error: errorMessage });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
