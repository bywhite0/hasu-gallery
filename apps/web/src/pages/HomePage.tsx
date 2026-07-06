import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button, EmptyState, ErrorState, StateMessage } from '@hasu-gallery/ui';
import type { WorkListItem } from '@hasu-gallery/types';
import { listWorks } from '../api/works';
import { useAuthStore } from '../store/auth';

type HomeFeedItem = WorkListItem & {
  gallery: 'meme' | 'art';
};

const galleryLabel: Record<HomeFeedItem['gallery'], string> = {
  meme: 'Meme',
  art: 'Art',
};

const getErrorDescription = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';

  if (message === 'Failed to fetch') {
    return 'The gallery API is not reachable right now. Start the backend service and try again.';
  }

  return message || 'The public feed could not be loaded. Please try again.';
};

export function HomePage() {
  const user = useAuthStore((state) => state.user);
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

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="max-w-3xl space-y-3">
          <h1 className="text-3xl font-semibold tracking-normal text-ink">Hasu Gallery</h1>
          <p className="text-sm leading-6 text-ink-2 md:text-base">
            Browse recent approved memes and fan art from the community. Sign in when you are ready to submit a work for review.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/gallery/meme">
            <Button variant="outline">Meme Gallery</Button>
          </Link>
          <Link to="/gallery/art">
            <Button variant="outline">Art Gallery</Button>
          </Link>
          <Link to="/upload">
            <Button>{user ? 'Upload' : 'Sign in to upload'}</Button>
          </Link>
        </div>
      </section>

      {isLoading && (
        <div className="space-y-4" aria-live="polite" aria-busy="true">
          <StateMessage
            title="Loading public feed"
            description="Fetching recent approved works from Meme and Art Gallery."
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
          title="Public feed unavailable"
          description={getErrorDescription(error)}
          action={
            <Button
              type="button"
              onClick={() => {
                void memeQuery.refetch();
                void artQuery.refetch();
              }}
              disabled={memeQuery.isFetching || artQuery.isFetching}
            >
              {memeQuery.isFetching || artQuery.isFetching ? 'Retrying...' : 'Retry'}
            </Button>
          }
        />
      )}

      {!isLoading && !hasError && feed.length === 0 && (
        <EmptyState
          title="No public works yet"
          description="Approved Meme and Art submissions will appear here once the gallery has published works."
          action={
            <Link to="/upload">
              <Button>{user ? 'Upload a work' : 'Sign in to upload'}</Button>
            </Link>
          }
        />
      )}

      {feed.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Recent public works</h2>
              <p className="text-sm text-ink-2">A mixed feed from Meme and Art Gallery.</p>
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
                        alt={`${work.title} thumbnail`}
                        loading="lazy"
                        decoding="async"
                        className="w-full object-cover"
                        onError={() => setImageFailures((current) => ({ ...current, [work.id]: true }))}
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center px-4 text-center text-sm text-ink-2">
                        Image unavailable
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 flex-1 text-sm font-semibold leading-5 text-ink">
                        {work.title}
                      </h3>
                      <span className="shrink-0 rounded-full border border-ink/15 px-2 py-0.5 text-xs font-medium text-ink-2">
                        {galleryLabel[work.gallery]}
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
