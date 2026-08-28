import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FictionWorkspacePage } from './FictionWorkspacePage';
import { listOwnerFictions } from '../api/fiction';
import { useAppStore } from '../store';

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
  Link: ({ children }: { children: React.ReactNode }) => <a href="#fiction">{children}</a>,
}));

vi.mock('../api/fiction', () => ({
  createFiction: vi.fn(),
  listOwnerFictions: vi.fn(),
  saveFictionDraft: vi.fn(),
  submitFiction: vi.fn(),
}));

const renderWorkspace = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FictionWorkspacePage />
    </QueryClientProvider>,
  );
};

describe('FictionWorkspacePage', () => {
  beforeEach(() => {
    useAppStore.setState({ locale: 'en' });
    vi.mocked(listOwnerFictions).mockResolvedValue([
      {
        id: 'revision-1',
        fiction_id: 'fiction-1',
        title: 'Published story',
        body: 'Published body',
        content_rating: 'all_ages',
        updated_at: '2026-07-18T00:00:00.000Z',
        state: 'published',
        revision_number: 1,
        work_version: 1,
        synopsis: 'Synopsis',
        fandom: 'Hasu no Sora',
        language: 'en',
      },
      {
        id: 'revision-2',
        fiction_id: 'fiction-2',
        title: 'Draft story',
        body: 'Draft body',
        content_rating: 'all_ages',
        updated_at: '2026-07-19T00:00:00.000Z',
        state: 'draft',
        revision_number: 1,
        work_version: 1,
        synopsis: 'Draft synopsis',
        fandom: 'Hasu no Sora',
        language: 'en',
      },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps published Fiction read-only and offers a replacement draft instead of direct publish', async () => {
    renderWorkspace();

    await screen.findByRole('button', { name: /Published story/ });
    screen.getByRole('button', { name: /Published story/ }).click();

    expect(await screen.findByText(/published revision is read-only/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Publish$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start replacement draft/i })).toBeInTheDocument();
    expect(screen.getByText('Open public page')).toBeInTheDocument();
  });

  it('keeps typed body content when the interface locale changes', async () => {
    renderWorkspace();

    (await screen.findByRole('button', { name: /Draft story/ })).click();
    const body = await screen.findByLabelText(/Story body/);
    fireEvent.change(body, { target: { value: 'Fresh words after midnight' } });

    act(() => {
      useAppStore.setState({ locale: 'ja' });
    });

    expect(body).toHaveValue('Fresh words after midnight');
  });

  it('asks before discarding unsaved changes when switching entries', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWorkspace();

    (await screen.findByRole('button', { name: /Draft story/ })).click();
    const body = await screen.findByLabelText(/Story body/);
    fireEvent.change(body, { target: { value: 'Fresh words after midnight' } });

    fireEvent.click(screen.getByRole('button', { name: /Published story/ }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(body).toHaveValue('Fresh words after midnight');

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: /Published story/ }));
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(await screen.findByLabelText(/Story body/)).toHaveValue('Published body');
  });

  it('switches without confirmation when there are no unsaved changes', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderWorkspace();

    (await screen.findByRole('button', { name: /Draft story/ })).click();
    fireEvent.click(await screen.findByRole('button', { name: /Published story/ }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(await screen.findByLabelText(/Story body/)).toHaveValue('Published body');
  });
});
