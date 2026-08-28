import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button, EmptyState, ErrorState } from '@hasu-gallery/ui';
import { listWorkFacets, listWorks } from '../api/works';
import { FilterPanel } from '../components/FilterPanel';
import { WorksGrid } from '../components/WorksGrid';
import { Pagination } from '../components/Pagination';
import { useAppStore, useAuthStore, type ArtRatingPreference } from '../store';
import { useI18n } from '../i18n';
import { reportClientError } from '../lib/errorReporting';
import { isNetworkError } from '../lib/network';

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

const getErrorDescription = (error: unknown, t: ReturnType<typeof useI18n>['t']) => {
  if (isNetworkError(error)) {
    return t('gallery.errorNetwork');
  }

  return t('gallery.errorFallback');
};

export function GalleryPage({ gallery }: GalleryPageProps) {
  const { t, galleryLabel, galleryShortLabel } = useI18n();
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
  const canViewNonApproved = user?.role === 'admin' || user?.role === 'moderator';
  // Guests may only request approved, all-ages works. A persisted r15/r18
  // preference from a previous login must never leak into guest requests,
  // or the backend answers 401 and the gallery becomes unusable.
  const queryFilters: Filters = isGuest
    ? {
        ...filters,
        status: 'approved',
        ...(gallery === 'art' ? { rating: 'all_ages' as const } : {}),
      }
    : filters;
  const facetsStatus = canViewNonApproved ? filters.status : 'approved';

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['works', gallery, page, queryFilters],
    queryFn: () => listWorks({ gallery, page, ...queryFilters }),
  });
  const errorReport = error
    ? reportClientError(error, { area: 'gallery', details: { gallery } })
    : null;

  const artFacetsQuery = useQuery({
    queryKey: ['workFacets', gallery, facetsStatus],
    queryFn: () => listWorkFacets({ gallery: 'art', status: facetsStatus }),
    enabled: gallery === 'art',
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

  const title = galleryLabel(gallery);
  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (!value) return false;
    if (gallery === 'art' && key === 'rating') return !isGuest && value !== 'all_ages';
    return true;
  });
  const emptyTitle = hasActiveFilters
    ? t('gallery.noMatchesTitle')
    : t('gallery.noWorksTitle', { gallery: galleryShortLabel(gallery) });
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
        artFacets={artFacetsQuery.data}
      />

      {isLoading && (
        <div className="space-y-4" aria-live="polite" aria-busy="true">
          <p className="sr-only">{t('gallery.loadingTitle')}</p>
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
          title={t('gallery.unavailableTitle')}
          description={
            <div className="space-y-1">
              <p>{getErrorDescription(error, t)}</p>
              {errorReport && <p>{t('error.reference', { reference: errorReport.reference })}</p>}
            </div>
          }
          action={
            <Button type="button" onClick={() => void refetch()} disabled={isFetching}>
              {isFetching ? t('common.retrying') : t('common.retry')}
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
              action={
                hasActiveFilters ? (
                  <Button type="button" variant="outline" onClick={handleResetFilters}>
                    {t('gallery.clearFilters')}
                  </Button>
                ) : (
                  <Link
                    to="/upload"
                    className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 font-medium text-paper transition-colors hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                  >
                    {t('home.uploadWork')}
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
