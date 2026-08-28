import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@hasu-gallery/types';
import { GalleryPage } from './GalleryPage';
import { listWorkFacets, listWorks } from '../api/works';
import { useAppStore, useAuthStore } from '../store';

// zustand's persist middleware resolves localStorage when the store module
// loads; provide a stable stub before any import touches it.
vi.hoisted(() => {
  const backing = new Map<string, string>();
  const stub: Storage = {
    getItem: (key) => backing.get(key) ?? null,
    setItem: (key, value) => void backing.set(key, value),
    removeItem: (key) => void backing.delete(key),
    clear: () => backing.clear(),
    key: (index) => [...backing.keys()][index] ?? null,
    get length() {
      return backing.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: stub,
    configurable: true,
    writable: true,
  });
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

vi.mock('../api/works', () => ({
  listWorks: vi.fn(),
  listWorkFacets: vi.fn(),
}));

const memberUser: User = {
  id: 1,
  handle: 'collector',
  email: 'collector@example.test',
  display_name: 'Collector',
  role: 'member',
  created_at: '2026-01-01T00:00:00Z',
};

const renderGallery = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <GalleryPage gallery="art" />
    </QueryClientProvider>,
  );
};

describe('GalleryPage guest rating clamp', () => {
  beforeEach(() => {
    vi.mocked(listWorks).mockReset();
    vi.mocked(listWorkFacets).mockReset();
    vi.mocked(listWorks).mockResolvedValue({
      works: [],
      pagination: { page: 1, limit: 24, total: 0, total_pages: 0 },
    });
    vi.mocked(listWorkFacets).mockResolvedValue({ artists: [], media: [], ratings: [] });
    // A member picked r18 in a previous session; the preference persists
    // across logout by design.
    useAppStore.setState({ artRatingPreference: 'r18' });
    useAuthStore.setState({ user: null });
  });

  it('requests only approved all-ages art for guests despite a persisted r18 preference', async () => {
    renderGallery();

    await waitFor(() => expect(listWorks).toHaveBeenCalled());
    expect(listWorks).toHaveBeenCalledWith(
      expect.objectContaining({ gallery: 'art', status: 'approved', rating: 'all_ages' }),
    );
    expect(listWorks).not.toHaveBeenCalledWith(expect.objectContaining({ rating: 'r18' }));
  });

  it('shows All Ages as the selected rating for guests instead of a blank select', async () => {
    renderGallery();

    const select = (await screen.findByLabelText('Rating')) as HTMLSelectElement;
    expect(select.value).toBe('all_ages');
    expect(screen.queryByRole('option', { name: /R-18/i })).not.toBeInTheDocument();
  });

  it('keeps the persisted r18 preference for logged-in members', async () => {
    useAuthStore.setState({ user: memberUser });

    renderGallery();

    await waitFor(() => expect(listWorks).toHaveBeenCalled());
    expect(listWorks).toHaveBeenCalledWith(
      expect.objectContaining({ gallery: 'art', rating: 'r18' }),
    );
  });
});
