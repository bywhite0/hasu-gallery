import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FictionWorkspacePage } from './FictionWorkspacePage';
import { listOwnerFictions } from '../api/fiction';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#fiction">{children}</a>,
}));

vi.mock('../api/fiction', () => ({
  createFiction: vi.fn(),
  listOwnerFictions: vi.fn(),
  saveFictionDraft: vi.fn(),
  submitFiction: vi.fn(),
}));

describe('FictionWorkspacePage', () => {
  beforeEach(() => {
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
    ]);
  });

  it('keeps published Fiction read-only and offers a replacement draft instead of direct publish', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <FictionWorkspacePage />
      </QueryClientProvider>,
    );

    await screen.findByRole('button', { name: /Published story/ });
    screen.getByRole('button', { name: /Published story/ }).click();

    expect(await screen.findByText(/published revision is read-only/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Publish$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start replacement draft/i })).toBeInTheDocument();
    expect(screen.getByText('Open public page')).toBeInTheDocument();
  });
});
