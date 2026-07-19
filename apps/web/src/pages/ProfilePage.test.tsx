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
      total: 5,
      pending: 1,
      approved: 1,
      rejected: 1,
      takedown: 1,
      image_total: 4,
      image_pending: 1,
      image_approved: 1,
      image_rejected: 1,
      image_takedown: 1,
      fiction_total: 1,
      fiction_pending: 0,
      fiction_approved: 1,
      fiction_rejected: 0,
      fiction_takedown: 0,
    });
    vi.mocked(getMyWorks).mockImplementation(async (params = {}) => {
      if (params.gallery === 'fiction') {
        return {
          works: [
            {
              id: 'fiction-1',
              gallery: 'fiction',
              origin: null,
              title: 'Quiet Orbit Acceptance',
              status: 'approved',
              thumbnail_url: '',
              file_url: '',
              width: 1,
              height: 1,
              created_at: '2026-07-20T00:00:00.000Z',
              reviewed_at: '2026-07-20T01:00:00.000Z',
              review_note: null,
            },
          ],
          pagination: {
            page: 1,
            limit: 24,
            total: 1,
            total_pages: 1,
          },
        };
      }

      return {
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
      };
    });
    useAuthStore.setState({
      user: memberUser,
      isLoading: false,
      hasCheckedAuth: true,
      error: null,
    });
  });

  it('splits Me into image and Fiction sections with independent filters', async () => {
    const user = userEvent.setup();

    renderProfilePage();

    expect(await screen.findByRole('heading', { name: 'Contributor' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Image submissions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fiction submissions' })).toBeInTheDocument();
    expect(screen.getByText('Needs a clearer source')).toBeInTheDocument();
    expect(screen.getByText('Quiet Orbit Acceptance')).toBeInTheDocument();
    expect(screen.getByText('Please add the original source URL.')).toBeInTheDocument();

    await waitFor(() => {
      expect(getMyWorks).toHaveBeenCalledWith({
        gallery: 'image',
        status: undefined,
        page: 1,
      });
      expect(getMyWorks).toHaveBeenCalledWith({
        gallery: 'fiction',
        status: undefined,
        page: 1,
      });
    });

    const imageFilters = screen.getByLabelText('Image submission status');
    await user.click(imageFilters.querySelector('button[aria-pressed="false"]') ?? imageFilters);

    // Click Removed inside image section only
    const imageRemoved = Array.from(imageFilters.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Removed'),
    );
    expect(imageRemoved).toBeTruthy();
    await user.click(imageRemoved!);

    await waitFor(() => {
      expect(getMyWorks).toHaveBeenCalledWith({
        gallery: 'image',
        status: 'takedown',
        page: 1,
      });
    });
  });

  it('opens Fiction routes instead of image work detail', async () => {
    const user = userEvent.setup();

    renderProfilePage();

    expect(await screen.findByText('Quiet Orbit Acceptance')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open Fiction' }));
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/fiction/$id',
      params: { id: 'fiction-1' },
    });
  });
});
