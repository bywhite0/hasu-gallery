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
        limit: 20,
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

    const galleryFilter = screen.getByLabelText('Gallery');
    const statusFilter = screen.getByLabelText('Status');

    expect(galleryFilter).toHaveValue('meme');
    expect(statusFilter).toHaveValue('pending');

    await waitFor(() => {
      expect(getModerationQueue).toHaveBeenCalledWith({
        gallery: 'meme',
        status: 'pending',
        page: 1,
        limit: 20,
      });
    });

    await user.selectOptions(galleryFilter, 'art');

    await waitFor(() => {
      expect(getModerationQueue).toHaveBeenCalledWith({
        gallery: 'art',
        status: 'pending',
        page: 1,
        limit: 20,
      });
    });
  });
});
