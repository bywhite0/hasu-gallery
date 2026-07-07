import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button, EmptyState, ErrorState, StateMessage } from '@hasu-gallery/ui';
import type { WorkListItem } from '@hasu-gallery/types';
import { listWorks } from '../api/works';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../i18n';
import { reportClientError } from '../lib/errorReporting';

type HomeFeedItem = WorkListItem & {
  gallery: 'meme' | 'art';
};

const getErrorDescription = (error: unknown, t: ReturnType<typeof useI18n>['t']) => {
  const message = error instanceof Error ? error.message : '';

  if (message === 'Failed to fetch') {
    return t('home.errorNetwork');
  }

  return t('home.errorFallback');
};

export function HomePage() {
  const user = useAuthStore((state) => state.user);
  const { t, galleryShortLabel } = useI18n();
  const [imageFailures, setImageFailures] = useState<Record<string, boolean>>({});

  const memeQuery = useQuery({
    queryKey: ['home-feed', 'meme'],
    queryFn: () => listWorks({ gallery: 'meme', status: 'approved', limit: 8, sort: 'created_at_desc' }),
  });

  const artQuery = useQuery({
    queryKey: ['home-feed', 'art'],
    queryFn: () =>
      listWorks({
        gallery: 'art',
        status: 'approved',
        rating: 'all_ages',
        limit: 8,
        sort: 'created_at_desc',
      }),
  });

  const feed = useMemo(() => {
    const works: HomeFeedItem[] = [
      ...(memeQuery.data?.works ?? []).map((work) => ({ ...work, gallery: 'meme' as const })),
      ...(artQuery.data?.works ?? []).map((work) => ({ ...work, gallery: 'art' as const })),
    ];

    return works
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 12);
  }, [artQuery.data?.works, memeQuery.data?.works]);

  const isLoading = memeQuery.isLoading || artQuery.isLoading;
  const hasError = memeQuery.error || artQuery.error;
  const error = memeQuery.error ?? artQuery.error;
  const errorReport = error
    ? reportClientError(error, { area: 'home-feed' })
    : null;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="max-w-3xl space-y-3">
          <h1 className="text-3xl font-semibold tracking-normal text-ink">Hasu Gallery</h1>
          <p className="text-sm leading-6 text-ink-2 md:text-base">
            {t('home.description')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/gallery/meme">
            <Button variant="outline">{t('gallery.meme')}</Button>
          </Link>
          <Link to="/gallery/art">
            <Button variant="outline">{t('gallery.art')}</Button>
          </Link>
          <Link to="/upload">
            <Button>{user ? t('nav.upload') : t('home.signInToUpload')}</Button>
          </Link>
        </div>
      </section>

      {isLoading && (
        <div className="space-y-4" aria-live="polite" aria-busy="true">
          <StateMessage
            title={t('home.loadingTitle')}
            description={t('home.loadingDescription')}
            tone="info"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="overflow-hidden rounded-md border border-ink/10 bg-surface">
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

      {!isLoading && hasError && feed.length === 0 && (
        <ErrorState
          title={t('home.errorTitle')}
          description={
            <div className="space-y-1">
              <p>{getErrorDescription(error, t)}</p>
              {errorReport && <p>{t('error.reference', { reference: errorReport.reference })}</p>}
            </div>
          }
          action={
            <Button
              type="button"
              onClick={() => {
                void memeQuery.refetch();
                void artQuery.refetch();
              }}
              disabled={memeQuery.isFetching || artQuery.isFetching}
            >
              {memeQuery.isFetching || artQuery.isFetching ? t('common.retrying') : t('common.retry')}
            </Button>
          }
        />
      )}

      {!isLoading && !hasError && feed.length === 0 && (
        <EmptyState
          title={t('home.emptyTitle')}
          description={t('home.emptyDescription')}
          action={
            <Link to="/upload">
              <Button>{user ? t('home.uploadWork') : t('home.signInToUpload')}</Button>
            </Link>
          }
        />
      )}

      {feed.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">{t('home.recentTitle')}</h2>
              <p className="text-sm text-ink-2">{t('home.recentDescription')}</p>
            </div>
          </div>
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-4">
            {feed.map((work) => {
              const imageFailed = Boolean(imageFailures[work.id]);
              const hasThumbnail = Boolean(work.thumbnail_url) && !imageFailed;

              return (
                <Link
                  key={work.id}
                  to="/works/$id"
                  params={{ id: work.id }}
                  className="mb-4 block break-inside-avoid overflow-hidden rounded-md border border-ink/15 bg-surface shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                >
                  <div className="overflow-hidden bg-accent/40">
                    {hasThumbnail ? (
                      <img
                        src={work.thumbnail_url}
                        alt={t('home.thumbnailAlt', { title: work.title })}
                        loading="lazy"
                        decoding="async"
                        className="w-full object-cover"
                        onError={() => setImageFailures((current) => ({ ...current, [work.id]: true }))}
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center px-4 text-center text-sm text-ink-2">
                        {t('common.imageUnavailable')}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 flex-1 text-sm font-semibold leading-5 text-ink">
                        {work.title}
                      </h3>
                      <span className="shrink-0 rounded-full border border-ink/15 px-2 py-0.5 text-xs font-medium text-ink-2">
                        {galleryShortLabel(work.gallery)}
                      </span>
                    </div>
                    <p className="text-xs leading-5 text-ink-2">
                      {work.width} x {work.height}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
