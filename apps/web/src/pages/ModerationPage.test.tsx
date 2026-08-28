import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModerationPage } from './ModerationPage';
import { getModerationQueue } from '../api/moderation';
import { useAuthStore } from '../store/auth';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../api/moderation', () => ({
  getModerationQueue: vi.fn(),
}));

const moderatorUser = {
  id: 1,
  handle: 'moderator',
  email: 'moderator@example.test',
  display_name: 'Moderator',
  role: 'moderator' as const,
  created_at: '2026-07-07T00:00:00.000Z',
};

function renderModerationPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ModerationPage />
    </QueryClientProvider>,
  );
}

describe('ModerationPage', () => {
  beforeEach(() => {
    vi.mocked(getModerationQueue).mockResolvedValue({
      works: [],
      pagination: {
        page: 1,
        limit: 1,
        total: 0,
        total_pages: 0,
      },
    });
    useAuthStore.setState({
      user: moderatorUser,
      isLoading: false,
      hasCheckedAuth: true,
      error: null,
    });
  });

  it('labels moderation filters and reloads the queue when gallery changes', async () => {
    const user = userEvent.setup();

    renderModerationPage();

    const queueKind = screen.getByLabelText('Queue');
    const galleryFilter = screen.getByLabelText('Gallery');
    const statusFilter = screen.getByLabelText('Status');

    expect(queueKind).toHaveValue('media');
    expect(galleryFilter).toHaveValue('meme');
    expect(statusFilter).toHaveValue('pending');

    await waitFor(() => {
      expect(getModerationQueue).toHaveBeenCalledWith({
        gallery: 'meme',
        status: 'pending',
        page: 1,
        limit: 1,
      });
    });

    await user.selectOptions(galleryFilter, 'art');

    await waitFor(() => {
      expect(getModerationQueue).toHaveBeenCalledWith({
        gallery: 'art',
        status: 'pending',
        page: 1,
        limit: 1,
      });
    });
  });

  it('moves through the queue one submission at a time', async () => {
    const user = userEvent.setup();
    vi.mocked(getModerationQueue).mockImplementation(async (params) => ({
      works: [
        {
          id: `work-${params.page ?? 1}`,
          title: `Pending work ${params.page ?? 1}`,
          gallery: 'meme',
          status: 'pending',
          uploader_handle: 'uploader',
          created_at: '2026-08-01T00:00:00.000Z',
        },
      ],
      pagination: { page: params.page ?? 1, limit: 1, total: 3, total_pages: 3 },
    }));

    renderModerationPage();

    expect(await screen.findByRole('heading', { name: 'Pending work 1' })).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByRole('heading', { name: 'Pending work 2' })).toBeInTheDocument();
    await waitFor(() => {
      expect(getModerationQueue).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, limit: 1 }),
      );
    });
  });
});
