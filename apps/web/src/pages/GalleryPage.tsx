import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button, EmptyState, ErrorState, StateMessage } from '@hasu-gallery/ui';
import { listWorks } from '../api/works';
import { FilterPanel } from '../components/FilterPanel';
import { WorksGrid } from '../components/WorksGrid';
import { Pagination } from '../components/Pagination';
import { useAppStore, useAuthStore, type ArtRatingPreference } from '../store';

interface GalleryPageProps {
  gallery: 'meme' | 'art';
}

type Filters = {
  status?: "pending" | "approved" | "rejected" | "takedown";
  origin?: "official" | "derived" | "fan_made";
  sort?: "created_at_desc" | "created_at_asc" | "title_asc";
  rating?: ArtRatingPreference;
  artist?: string;
  medium?: string;
};

const getInitialFilters = (
  gallery: GalleryPageProps['gallery'],
  artRatingPreference: ArtRatingPreference,
): Filters => (gallery === 'art' ? { rating: artRatingPreference } : {});

const getResetFilters = (gallery: GalleryPageProps['gallery']): Filters =>
  gallery === 'art' ? { rating: 'all_ages' } : {};

const getErrorDescription = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';

  if (message === 'Failed to fetch') {
    return 'The gallery API is not reachable right now. Start the backend service and try again.';
  }

  return message || 'The gallery could not be loaded. Please try again.';
};

export function GalleryPage({ gallery }: GalleryPageProps) {
  const user = useAuthStore((state) => state.user);
  const artRatingPreference = useAppStore((state) => state.artRatingPreference);
  const setArtRatingPreference = useAppStore((state) => state.setArtRatingPreference);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(() =>
    getInitialFilters(gallery, artRatingPreference),
  );

  useEffect(() => {
    setFilters((currentFilters) => {
      if (gallery === 'art') {
        return {
          status: currentFilters.status,
          sort: currentFilters.sort,
          rating: artRatingPreference,
          artist: currentFilters.artist,
          medium: currentFilters.medium,
        };
      }

      return {
        status: currentFilters.status,
        origin: currentFilters.origin,
        sort: currentFilters.sort,
      };
    });
    setPage(1);
  }, [artRatingPreference, gallery]);

  const isGuest = !user;
  const queryFilters: Filters = isGuest ? { ...filters, status: 'approved' } : filters;

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['works', gallery, page, queryFilters],
    queryFn: () => listWorks({ gallery, page, ...queryFilters }),
  });

  const handleFilterChange = (newFilters: Filters) => {
    const nextRating = newFilters.rating ?? artRatingPreference;
    const nextFilters: Filters =
      gallery === 'art'
        ? { ...newFilters, rating: nextRating }
        : newFilters;

    if (gallery === 'art' && nextRating !== artRatingPreference) {
      setArtRatingPreference(nextRating);
    }

    setFilters(nextFilters);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleResetFilters = () => {
    const nextFilters = getResetFilters(gallery);

    if (gallery === 'art') {
      setArtRatingPreference('all_ages');
    }

    setFilters(nextFilters);
    setPage(1);
  };

  const title = gallery === 'meme' ? 'Meme Gallery' : 'Art Gallery';
  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (!value) return false;
    if (gallery === 'art' && key === 'rating') return value !== 'all_ages';
    return true;
  });
  const emptyTitle = hasActiveFilters ? 'No works match these filters' : `No ${gallery} works yet`;
  const emptyDescription = hasActiveFilters
    ? 'Clear the current filters to return to the full server-side gallery result.'
    : 'Be the first to add a work once the backend is available for uploads.';

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{title}</h1>

      <FilterPanel
        gallery={gallery}
        filters={filters}
        onFilterChange={handleFilterChange}
        hasActiveFilters={hasActiveFilters}
        onReset={handleResetFilters}
        isGuest={isGuest}
      />

      {isLoading && (
        <div className="space-y-4" aria-live="polite" aria-busy="true">
          <StateMessage
            title="Loading gallery"
            description="Fetching the current page from the server with your selected filters."
            tone="info"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-md border border-ink/10 bg-surface"
              >
                <div className="aspect-square animate-pulse bg-accent" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-4/5 animate-pulse rounded bg-ink/10" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-ink/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <ErrorState
          title="Gallery unavailable"
          description={getErrorDescription(error)}
          action={
            <Button type="button" onClick={() => void refetch()} disabled={isFetching}>
              {isFetching ? 'Retrying...' : 'Retry'}
            </Button>
          }
        />
      )}

      {data && (
        <>
          {data.works.length > 0 ? (
            <WorksGrid works={data.works} />
          ) : (
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
              action={
                hasActiveFilters ? (
                  <Button type="button" variant="outline" onClick={handleResetFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Link
                    to="/upload"
                    className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 font-medium text-paper transition-colors hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                  >
                    Upload a work
                  </Link>
                )
              }
            />
          )}
          {data.pagination.total_pages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={data.pagination.total_pages}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </div>
  );
}
