import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { listWorks } from '../api/works';
import { FilterPanel } from '../components/FilterPanel';
import { WorksGrid } from '../components/WorksGrid';
import { Pagination } from '../components/Pagination';

interface GalleryPageProps {
  gallery: 'meme' | 'art';
}

interface Filters {
  status?: string;
  origin?: string;
  sort?: string;
}

export function GalleryPage({ gallery }: GalleryPageProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['works', gallery, page, filters],
    queryFn: () => listWorks({ gallery, page, ...filters }),
  });

  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleWorkClick = (workId: string) => {
    navigate({ to: `/works/${workId}` });
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
