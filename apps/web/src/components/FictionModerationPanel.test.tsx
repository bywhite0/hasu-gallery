import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FictionRevision } from '@hasu-gallery/types';
import { FictionModerationPanel } from './FictionModerationPanel';
import { listFictionModerationQueue } from '../api/fiction';

vi.mock('../api/fiction', () => ({
  listFictionModerationQueue: vi.fn(),
  decideFictionRevision: vi.fn(),
}));

const revision = (n: number): FictionRevision => ({
  id: `revision-${n}`,
  fiction_id: `fiction-${n}`,
  title: `Pending fiction ${n}`,
  body: `Body ${n}`,
  revision_number: 1,
  content_rating: 'all_ages',
  status: 'pending',
  created_at: '2026-08-01T00:00:00.000Z',
  plain_text_excerpt: `Excerpt ${n}`,
  word_count: 100,
});

const renderPanel = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FictionModerationPanel />
    </QueryClientProvider>,
  );
};

describe('FictionModerationPanel', () => {
  beforeEach(() => {
    vi.mocked(listFictionModerationQueue).mockResolvedValue([revision(1), revision(2)]);
  });

  it('navigates between pending revisions and clears the draft note', async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(await screen.findByRole('heading', { name: 'Pending fiction 1' })).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Review note (optional)'), 'half-written note');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByRole('heading', { name: 'Pending fiction 2' })).toBeInTheDocument();
    expect(screen.getByLabelText('Review note (optional)')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Prev' }));
    expect(await screen.findByRole('heading', { name: 'Pending fiction 1' })).toBeInTheDocument();
  });
});
