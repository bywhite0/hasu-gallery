import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { create, ContentRating, PublicFictionListResponseSchema } from '@hasu-gallery/proto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FictionBrowsePage } from './FictionBrowsePage';
import { listPublicFictions } from '../api/fiction';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <a {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

vi.mock('../api/fiction', () => ({
  listPublicFictions: vi.fn(),
}));

describe('FictionBrowsePage', () => {
  beforeEach(() => {
    vi.mocked(listPublicFictions).mockResolvedValue(
      create(PublicFictionListResponseSchema, {
        items: [
          {
            id: 'fiction-1',
            title: 'A quiet orbit',
            summary: 'Two friends find a signal after midnight.',
            authorHandle: 'reader',
            fandom: 'Hasu no Sora',
            language: 'en',
            wordCount: 420,
            contentRating: ContentRating.ALL_AGES,
          },
        ],
        page: 1,
        limit: 20,
        total: 1n,
        totalPages: 1,
      }),
    );
  });

  it('shows a text-first public fiction entry', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <FictionBrowsePage />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Fiction' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'A quiet orbit' })).toBeInTheDocument();
    expect(screen.getByText('@reader')).toBeInTheDocument();
    expect(screen.getByText('420 words')).toBeInTheDocument();
  });
});
