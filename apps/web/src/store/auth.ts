import { create } from 'zustand';
import type { User } from '@hasu-gallery/types';
import { login as apiLogin, register as apiRegister, logout as apiLogout, me as apiMe } from '../api/auth';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (handle: string, password: string) => Promise<void>;
  register: (handle: string, email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  error: null,

  login: async (handle: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const user = await apiLogin({ handle, password });
      set({ user, isLoading: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      set({ error: errorMessage, isLoading: false });
      throw err;
    }
  },

  register: async (handle: string, email: string, password: string, displayName?: string) => {
    set({ isLoading: true, error: null });
    try {
      const user = await apiRegister({ handle, email, password, display_name: displayName });
      set({ user, isLoading: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      set({ error: errorMessage, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await apiLogout();
      set({ user: null, isLoading: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Logout failed';
      set({ error: errorMessage, isLoading: false });
      throw err;
    }
  },

  checkAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = await apiMe();
      set({ user, isLoading: false });
    } catch (err) {
      // Not logged in or session expired - clear user silently
      set({ user: null, isLoading: false, error: null });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
