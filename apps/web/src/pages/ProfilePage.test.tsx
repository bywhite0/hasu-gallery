import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';
import { getMyStats, getMyWorks } from '../api/profile';
import { useAuthStore } from '../store/auth';

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../api/profile', () => ({
  getMyStats: vi.fn(),
  getMyWorks: vi.fn(),
}));

const memberUser = {
  id: 7,
  handle: 'contributor',
  email: 'contributor@example.test',
  display_name: 'Contributor',
  role: 'member' as const,
  created_at: '2026-07-01T00:00:00.000Z',
};

function renderProfilePage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProfilePage />
    </QueryClientProvider>,
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.mocked(getMyStats).mockResolvedValue({
      total: 4,
      pending: 1,
      approved: 1,
      rejected: 1,
      takedown: 1,
    });
    vi.mocked(getMyWorks).mockResolvedValue({
      works: [
        {
          id: 'work-1',
          gallery: 'art',
          origin: null,
          title: 'Needs a clearer source',
          status: 'rejected',
          thumbnail_url: '',
          file_url: 'https://assets.example/work-1.jpg',
          width: 1200,
          height: 900,
          created_at: '2026-07-02T00:00:00.000Z',
          reviewed_at: '2026-07-03T00:00:00.000Z',
          review_note: 'Please add the original source URL.',
        },
      ],
      pagination: {
        page: 1,
        limit: 24,
        total: 1,
        total_pages: 1,
      },
    });
    useAuthStore.setState({
      user: memberUser,
      isLoading: false,
      hasCheckedAuth: true,
      error: null,
    });
  });

  it('shows submission workspace status, review notes, and status filtering', async () => {
    const user = userEvent.setup();

    renderProfilePage();

    expect(await screen.findByRole('heading', { name: 'Contributor' })).toBeInTheDocument();
    expect(screen.getByText('My uploads')).toBeInTheDocument();
    expect(screen.getAllByText('Contributor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('@contributor').length).toBeGreaterThan(0);
    expect(screen.getByText('Total Uploads')).toBeInTheDocument();
    expect(screen.queryByText('contributor@example.test')).not.toBeInTheDocument();
    expect(screen.getByText('Needs a clearer source')).toBeInTheDocument();
    expect(screen.getByText('Please add the original source URL.')).toBeInTheDocument();
    expect(screen.getByText('Needs your attention')).toBeInTheDocument();
    expect(screen.getByText('1 removed')).toBeInTheDocument();

    await waitFor(() => {
      expect(getMyWorks).toHaveBeenCalledWith({ status: undefined, page: 1 });
    });

    await user.click(screen.getByRole('button', { name: /^Removed1$/ }));

    await waitFor(() => {
      expect(getMyWorks).toHaveBeenCalledWith({ status: 'takedown', page: 1 });
    });
  });
});
