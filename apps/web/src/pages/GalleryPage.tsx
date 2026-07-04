import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { listWorks } from '../api/works';
import { FilterPanel } from '../components/FilterPanel';
import { WorksGrid } from '../components/WorksGrid';
import { Pagination } from '../components/Pagination';
import { useAppStore, type ArtRatingPreference } from '../store';

interface GalleryPageProps {
  gallery: 'meme' | 'art';
}

type Filters = {
  status?: "pending" | "approved" | "rejected";
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

export function GalleryPage({ gallery }: GalleryPageProps) {
  const navigate = useNavigate();
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

  const { data, isLoading, error } = useQuery({
    queryKey: ['works', gallery, page, filters],
    queryFn: () => listWorks({ gallery, page, ...filters }),
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

  const handleWorkClick = (id: string) => {
    navigate({ to: `/works/${id}` });
  };

  const title = gallery === 'meme' ? 'Meme Gallery' : 'Art Gallery';

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{title}</h1>

      <FilterPanel
        gallery={gallery}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {isLoading && (
        <div className="text-center py-12 text-ink-2">
          Loading works...
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-danger">
          Error: {error.message}
        </div>
      )}

      {data && (
        <>
          <WorksGrid works={data.works} onWorkClick={handleWorkClick} />
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
