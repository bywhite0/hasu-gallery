import { Button } from '@hasu-gallery/ui';

interface FilterPanelProps {
  gallery: 'meme' | 'art';
  filters: {
    status?: "pending" | "approved" | "rejected";
    origin?: "official" | "derived" | "fan_made";
    sort?: "created_at_desc" | "created_at_asc" | "title_asc";
    rating?: "all_ages" | "r15" | "r18";
    artist?: string;
    medium?: string;
  };
  onFilterChange: (filters: {
    status?: "pending" | "approved" | "rejected";
    origin?: "official" | "derived" | "fan_made";
    sort?: "created_at_desc" | "created_at_asc" | "title_asc";
    rating?: "all_ages" | "r15" | "r18";
    artist?: string;
    medium?: string;
  }) => void;
  hasActiveFilters?: boolean;
  onReset?: () => void;
}

export function FilterPanel({
  gallery,
  filters,
  onFilterChange,
  hasActiveFilters = false,
  onReset,
}: FilterPanelProps) {
  const handleChange = (key: string, value: string) => {
    const newValue = value === 'all' ? undefined : value;
    onFilterChange({ ...filters, [key]: newValue });
  };

  const handleTextChange = (key: 'artist' | 'medium', value: string) => {
    const newValue = /\S/.test(value) ? value : undefined;
    onFilterChange({ ...filters, [key]: newValue });
  };

  // Map display values to API values
  const sortValueMap: Record<string, "created_at_desc" | "created_at_asc" | "title_asc"> = {
    'newest': 'created_at_desc',
    'oldest': 'created_at_asc',
    'title-az': 'title_asc',
  };

  const currentSortDisplay = Object.entries(sortValueMap).find(
    ([_, apiValue]) => apiValue === filters.sort
  )?.[0] || 'newest';

  return (
    <div className="mb-6 flex flex-wrap items-end gap-4 rounded-md border border-ink/15 bg-surface p-4">
      <div className="flex items-center gap-2">
        <label htmlFor="status-filter" className="text-sm font-medium">
          Status
        </label>
        <select
          id="status-filter"
          value={filters.status || 'all'}
          onChange={(e) => handleChange('status', e.target.value)}
          className="rounded border border-ink/30 bg-paper px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-surface"
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {gallery === 'meme' && (
        <div className="flex items-center gap-2">
          <label htmlFor="origin-filter" className="text-sm font-medium">
            Origin
          </label>
          <select
            id="origin-filter"
            value={filters.origin || 'all'}
            onChange={(e) => handleChange('origin', e.target.value)}
            className="rounded border border-ink/30 bg-paper px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-surface"
          >
            <option value="all">All</option>
            <option value="official">Official</option>
            <option value="derived">Derived</option>
            <option value="fan_made">Fan Made</option>
          </select>
        </div>
      )}

      <div className="flex items-center gap-2">
        <label htmlFor="sort-filter" className="text-sm font-medium">
          Sort
        </label>
        <select
          id="sort-filter"
          value={currentSortDisplay}
          onChange={(e) => handleChange('sort', sortValueMap[e.target.value])}
          className="rounded border border-ink/30 bg-paper px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-surface"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="title-az">Title A-Z</option>
        </select>
      </div>

      {gallery === 'art' && (
        <>
          <div className="flex items-center gap-2">
            <label htmlFor="rating-filter" className="text-sm font-medium">
              Rating
            </label>
            <select
              id="rating-filter"
              value={filters.rating || 'all_ages'}
              onChange={(e) => handleChange('rating', e.target.value)}
              className="rounded border border-ink/30 bg-paper px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-surface"
            >
              <option value="all_ages">All Ages</option>
              <option value="r15">R-15</option>
              <option value="r18">R-18</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="artist-filter" className="text-sm font-medium">
              Artist
            </label>
            <input
              id="artist-filter"
              type="search"
              value={filters.artist || ''}
              onChange={(e) => handleTextChange('artist', e.target.value)}
              placeholder="Name"
              className="w-40 rounded border border-ink/30 bg-paper px-3 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-surface"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="medium-filter" className="text-sm font-medium">
              Medium
            </label>
            <input
              id="medium-filter"
              type="search"
              value={filters.medium || ''}
              onChange={(e) => handleTextChange('medium', e.target.value)}
              placeholder="Digital, scan..."
              className="w-40 rounded border border-ink/30 bg-paper px-3 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-surface"
            />
          </div>
        </>
      )}

      {hasActiveFilters && onReset && (
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
