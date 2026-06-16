interface FilterPanelProps {
  gallery: 'meme' | 'art';
  filters: {
    status?: string;
    origin?: string;
    sort?: string;
  };
  onFilterChange: (filters: { status?: string; origin?: string; sort?: string }) => void;
}

export function FilterPanel({ gallery, filters, onFilterChange }: FilterPanelProps) {
  const handleChange = (key: string, value: string) => {
    const newValue = value === 'all' ? undefined : value;
    onFilterChange({ ...filters, [key]: newValue });
  };

  // Map display values to API values
  const sortValueMap: Record<string, string> = {
    'newest': 'created_at_desc',
    'oldest': 'created_at_asc',
    'title-az': 'title_asc',
  };

  const currentSortDisplay = Object.entries(sortValueMap).find(
    ([_, apiValue]) => apiValue === filters.sort
  )?.[0] || 'newest';

  return (
    <div className="flex gap-4 items-center flex-wrap mb-6">
      <div className="flex items-center gap-2">
        <label htmlFor="status-filter" className="text-sm font-medium">
          Status:
        </label>
        <select
          id="status-filter"
          value={filters.status || 'all'}
          onChange={(e) => handleChange('status', e.target.value)}
          className="px-3 py-1.5 border border-ink rounded bg-surface text-sm"
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
            Origin:
          </label>
          <select
            id="origin-filter"
            value={filters.origin || 'all'}
            onChange={(e) => handleChange('origin', e.target.value)}
            className="px-3 py-1.5 border border-ink rounded bg-surface text-sm"
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
          Sort:
        </label>
        <select
          id="sort-filter"
          value={currentSortDisplay}
          onChange={(e) => handleChange('sort', sortValueMap[e.target.value])}
          className="px-3 py-1.5 border border-ink rounded bg-surface text-sm"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="title-az">Title A-Z</option>
        </select>
      </div>
    </div>
  );
}
