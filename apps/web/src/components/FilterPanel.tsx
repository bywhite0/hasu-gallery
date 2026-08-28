import { Button } from '@hasu-gallery/ui';
import type { WorkFacet, WorksFacetsResponse } from '@hasu-gallery/types';
import { useI18n } from '../i18n';

interface FilterPanelProps {
  gallery: 'meme' | 'art';
  filters: {
    status?: "pending" | "approved" | "rejected" | "takedown";
    origin?: "official" | "derived" | "fan_made";
    sort?: "created_at_desc" | "created_at_asc" | "title_asc";
    rating?: "all_ages" | "r15" | "r18";
    artist?: string;
    medium?: string;
  };
  onFilterChange: (filters: {
    status?: "pending" | "approved" | "rejected" | "takedown";
    origin?: "official" | "derived" | "fan_made";
    sort?: "created_at_desc" | "created_at_asc" | "title_asc";
    rating?: "all_ages" | "r15" | "r18";
    artist?: string;
    medium?: string;
  }) => void;
  hasActiveFilters?: boolean;
  onReset?: () => void;
  isGuest?: boolean;
  artFacets?: WorksFacetsResponse;
}

const getFacetCount = (facets: WorkFacet[] | undefined, value: string) =>
  facets?.find((facet) => facet.value === value)?.count;

const formatRatingLabel = (
  label: string,
  facets: WorkFacet[] | undefined,
  value: string,
) => {
  const count = getFacetCount(facets, value);
  return typeof count === 'number' ? `${label} (${count})` : label;
};

export function FilterPanel({
  gallery,
  filters,
  onFilterChange,
  hasActiveFilters = false,
  onReset,
  isGuest = false,
  artFacets,
}: FilterPanelProps) {
  const { t, originLabel, ratingLabel } = useI18n();
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
      {!isGuest && (
        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-sm font-medium">
            {t('filter.status')}
          </label>
          <select
            id="status-filter"
            value={filters.status || 'all'}
            onChange={(e) => handleChange('status', e.target.value)}
            className="rounded border border-ink/30 bg-paper px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-surface"
          >
            <option value="all">{t('common.all')}</option>
            <option value="pending">{t('status.pending')}</option>
            <option value="approved">{t('status.approved')}</option>
            <option value="rejected">{t('status.rejected')}</option>
            <option value="takedown">{t('status.takedown')}</option>
          </select>
        </div>
      )}

      {gallery === 'meme' && (
        <div className="flex items-center gap-2">
          <label htmlFor="origin-filter" className="text-sm font-medium">
            {t('filter.origin')}
          </label>
          <select
            id="origin-filter"
            value={filters.origin || 'all'}
            onChange={(e) => handleChange('origin', e.target.value)}
            className="rounded border border-ink/30 bg-paper px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-surface"
          >
            <option value="all">{t('common.all')}</option>
            <option value="official">{originLabel('official')}</option>
            <option value="derived">{originLabel('derived')}</option>
            <option value="fan_made">{originLabel('fan_made')}</option>
          </select>
        </div>
      )}

      <div className="flex items-center gap-2">
        <label htmlFor="sort-filter" className="text-sm font-medium">
          {t('filter.sort')}
        </label>
        <select
          id="sort-filter"
          value={currentSortDisplay}
          onChange={(e) => handleChange('sort', sortValueMap[e.target.value])}
          className="rounded border border-ink/30 bg-paper px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-surface"
        >
          <option value="newest">{t('filter.sortNewest')}</option>
          <option value="oldest">{t('filter.sortOldest')}</option>
          <option value="title-az">{t('filter.sortTitleAz')}</option>
        </select>
      </div>

      {gallery === 'art' && (
        <>
          <div className="flex items-center gap-2">
            <label htmlFor="rating-filter" className="text-sm font-medium">
              {t('filter.rating')}
            </label>
            <select
              id="rating-filter"
              value={isGuest ? 'all_ages' : filters.rating || 'all_ages'}
              onChange={(e) => handleChange('rating', e.target.value)}
              className="rounded border border-ink/30 bg-paper px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-surface"
            >
              <option value="all_ages">
                {formatRatingLabel(ratingLabel('all_ages'), artFacets?.ratings, 'all_ages')}
              </option>
              {!isGuest && (
                <>
                  <option value="r15">
                    {formatRatingLabel(ratingLabel('r15'), artFacets?.ratings, 'r15')}
                  </option>
                  <option value="r18">
                    {formatRatingLabel(ratingLabel('r18'), artFacets?.ratings, 'r18')}
                  </option>
                </>
              )}
            </select>
          </div>

          {isGuest && (
            <p className="max-w-xs text-xs leading-5 text-ink-2">
              {t('filter.guestRatingHint')}
            </p>
          )}

          <div className="flex items-center gap-2">
            <label htmlFor="artist-filter" className="text-sm font-medium">
              {t('filter.artist')}
            </label>
            <input
              id="artist-filter"
              type="search"
              list="artist-filter-options"
              value={filters.artist || ''}
              onChange={(e) => handleTextChange('artist', e.target.value)}
              placeholder={t('filter.artistPlaceholder')}
              className="w-40 rounded border border-ink/30 bg-paper px-3 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-surface"
            />
            {artFacets?.artists.length ? (
              <datalist id="artist-filter-options">
                {artFacets.artists.map((facet) => (
                  <option
                    key={facet.value}
                    value={facet.value}
                    label={t('common.workCount', { count: facet.count })}
                  />
                ))}
              </datalist>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="medium-filter" className="text-sm font-medium">
              {t('filter.medium')}
            </label>
            <input
              id="medium-filter"
              type="search"
              list="medium-filter-options"
              value={filters.medium || ''}
              onChange={(e) => handleTextChange('medium', e.target.value)}
              placeholder={t('filter.mediumPlaceholder')}
              className="w-40 rounded border border-ink/30 bg-paper px-3 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-surface"
            />
            {artFacets?.media.length ? (
              <datalist id="medium-filter-options">
                {artFacets.media.map((facet) => (
                  <option
                    key={facet.value}
                    value={facet.value}
                    label={t('common.workCount', { count: facet.count })}
                  />
                ))}
              </datalist>
            ) : null}
          </div>
        </>
      )}

      {hasActiveFilters && onReset && (
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          {t('gallery.clearFilters')}
        </Button>
      )}
    </div>
  );
}
