import { FormEvent, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { PenLine, Search } from 'lucide-react';
import { Button, EmptyState, ErrorState, Field, Input, buttonStyles } from '@hasu-gallery/ui';
import { listPublicFictions } from '../api/fiction';
import { FictionSummaryList } from '../components/FictionSummaryList';
import { Pagination } from '../components/Pagination';
import { useI18n } from '../i18n';
import { fictionErrorKey, toSafeNumber } from '../lib/fiction';
import { useAuthStore } from '../store/auth';

export function FictionBrowsePage() {
  const search = useSearch({ from: '/fiction' });
  const navigate = useNavigate({ from: '/fiction' });
  const user = useAuthStore((state) => state.user);
  const { t, formatNumber } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [query, setQuery] = useState(search.q ?? '');
  const [fandom, setFandom] = useState(search.fandom ?? '');

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    setQuery(search.q ?? '');
    setFandom(search.fandom ?? '');
  }, [search.fandom, search.q]);

  const fictionQuery = useQuery({
    queryKey: ['fiction', 'public', search.page ?? 1, search.q, search.fandom],
    queryFn: () =>
      listPublicFictions({
        page: search.page ?? 1,
        limit: 20,
        query: search.q,
        fandom: search.fandom,
      }),
  });

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    void navigate({
      to: '/fiction',
      search: {
        q: query.trim() || undefined,
        fandom: fandom.trim() || undefined,
        page: 1,
      },
    });
  };

  const clearFilters = () => {
    setQuery('');
    setFandom('');
    void navigate({ to: '/fiction', search: {} });
  };

  const hasFilters = Boolean(search.q || search.fandom);
  const data = fictionQuery.data;
  const total = data ? toSafeNumber(data.total) : 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 pb-8 pt-2 sm:pt-4">
      <section className="grid gap-4 border-b border-ink/15 pb-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="max-w-3xl">
          <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {t('fiction.title')}
          </h1>
        </div>
        <Link
          to="/profile/fictions"
          className={buttonStyles({ className: 'min-h-11 w-full sm:w-auto' })}
        >
          <PenLine className="mr-2 h-4 w-4" aria-hidden="true" />
          {user ? t('fiction.write') : t('fiction.signInToWrite')}
        </Link>
      </section>

      <form onSubmit={applyFilters} className="grid gap-3 border-b border-ink/10 pb-6 md:grid-cols-[minmax(0,1.4fr)_minmax(12rem,0.8fr)_auto] md:items-end">
        <Field label={t('fiction.searchLabel')} htmlFor="fiction-search">
          <Input
            id="fiction-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('fiction.searchPlaceholder')}
            maxLength={200}
          />
        </Field>
        <Field label={t('fiction.fandom')} htmlFor="fiction-fandom">
          <Input
            id="fiction-fandom"
            value={fandom}
            onChange={(event) => setFandom(event.target.value)}
            placeholder={t('fiction.fandomPlaceholder')}
            maxLength={120}
          />
        </Field>
        <div className="flex min-h-10 gap-2">
          <Button type="submit" className="min-h-11 flex-1 md:flex-none">
            <Search className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('fiction.applyFilters')}
          </Button>
          {hasFilters && (
            <Button type="button" variant="ghost" className="min-h-11" onClick={clearFilters}>
              {t('fiction.clearFilters')}
            </Button>
          )}
        </div>
      </form>

      {fictionQuery.isLoading && (
        <div className="space-y-5" aria-busy="true" aria-live="polite">
          <p className="sr-only">{t('fiction.loading')}</p>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="border-b border-ink/10 pb-5">
              <div className="h-5 w-2/5 animate-pulse rounded bg-ink/10" />
              <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-ink/10" />
              <div className="mt-2 h-4 w-3/5 animate-pulse rounded bg-ink/10" />
            </div>
          ))}
        </div>
      )}

      {fictionQuery.error && (
        <ErrorState
          title={t('fiction.unavailableTitle')}
          description={t(fictionErrorKey(fictionQuery.error, 'fiction.errorFallback'))}
          action={
            <Button type="button" onClick={() => void fictionQuery.refetch()} disabled={fictionQuery.isFetching}>
              {fictionQuery.isFetching ? t('common.retrying') : t('common.retry')}
            </Button>
          }
        />
      )}

      {data && !fictionQuery.error && (
        <section className="space-y-4" aria-labelledby="fiction-results-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="fiction-results-heading" className="text-lg font-semibold text-ink">
              {t('fiction.results')}
            </h2>
            <p className="text-sm text-ink-2">{t('fiction.resultCount', { count: formatNumber(total) })}</p>
          </div>

          {data.items.length > 0 ? (
            <>
              <FictionSummaryList items={data.items} />
              {data.totalPages > 1 && (
                <Pagination
                  currentPage={data.page}
                  totalPages={data.totalPages}
                  onPageChange={(page) => {
                    void navigate({
                      to: '/fiction',
                      search: { q: search.q, fandom: search.fandom, page },
                    });
                  }}
                />
              )}
            </>
          ) : (
            <EmptyState
              title={hasFilters ? t('fiction.noMatchesTitle') : t('fiction.emptyTitle')}
              action={
                hasFilters ? (
                  <Button type="button" variant="outline" onClick={clearFilters}>
                    {t('fiction.clearFilters')}
                  </Button>
                ) : (
                  <Link to="/profile/fictions" className={buttonStyles()}>
                    {user ? t('fiction.write') : t('fiction.signInToWrite')}
                  </Link>
                )
              }
            />
          )}
        </section>
      )}
    </div>
  );
}
