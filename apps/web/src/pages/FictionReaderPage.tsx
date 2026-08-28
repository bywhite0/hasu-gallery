import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, AtSign, BookOpenText, Languages } from 'lucide-react';
import { Button, ErrorState, buttonStyles } from '@hasu-gallery/ui';
import { getPublicFiction } from '../api/fiction';
import { FictionBody } from '../components/FictionBody';
import { useI18n } from '../i18n';
import { fictionErrorKey } from '../lib/fiction';

const readerSkeletonWidths = ['w-[86%]', 'w-[77%]', 'w-[68%]'] as const;

export function FictionReaderPage() {
  const { id } = useParams({ from: '/fiction/$id' });
  const { t, formatDate, formatLanguage, formatNumber, ratingLabel } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fictionQuery = useQuery({
    queryKey: ['fiction', 'public', 'detail', id],
    queryFn: () => getPublicFiction(id),
  });

  useEffect(() => {
    if (fictionQuery.data) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [fictionQuery.data]);

  if (fictionQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-7 py-8" aria-busy="true" aria-live="polite">
        <p className="sr-only">{t('fiction.loadingReader')}</p>
        <div className="h-4 w-24 animate-pulse rounded bg-ink/10" />
        <div className="h-10 w-4/5 animate-pulse rounded bg-ink/10" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-ink/10" />
        <div className="space-y-4 pt-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className={`h-4 animate-pulse rounded bg-ink/10 ${readerSkeletonWidths[index % readerSkeletonWidths.length]}`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (fictionQuery.error || !fictionQuery.data) {
    return (
      <div className="mx-auto max-w-3xl py-8">
        <ErrorState
          title={t('fiction.readerUnavailableTitle')}
          description={t(fictionErrorKey(fictionQuery.error, 'fiction.readerUnavailableDescription'))}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={() => void fictionQuery.refetch()} disabled={fictionQuery.isFetching}>
                {fictionQuery.isFetching ? t('common.retrying') : t('common.retry')}
              </Button>
              <Link to="/fiction" className={buttonStyles({ variant: 'outline' })}>
                {t('fiction.backToBrowse')}
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const fiction = fictionQuery.data;

  return (
    <article lang={fiction.language || undefined} className="mx-auto w-full max-w-4xl pb-14 pt-3 sm:pt-6">
      <Link
        to="/fiction"
        className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-ink-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('fiction.backToBrowse')}
      </Link>

      <header className="mt-6 border-b border-ink/15 pb-7">
        <div className="flex items-center gap-2 text-sm font-medium text-ink-2">
          <BookOpenText className="h-4 w-4" aria-hidden="true" />
          {fiction.fandom || t('fiction.collectionLabel')}
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl sm:leading-[1.12]">
          {fiction.title}
        </h1>
        {fiction.summary && (
          <p className="mt-4 max-w-3xl text-base leading-7 text-ink-2 sm:text-lg">
            {fiction.summary}
          </p>
        )}
        <dl className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2">
          <div className="flex items-center gap-1.5">
            <AtSign className="h-4 w-4" aria-hidden="true" />
            <dt className="sr-only">{t('fiction.author')}</dt>
            <dd>{fiction.author_handle || t('common.unknown')}</dd>
          </div>
          {fiction.language && (
            <div className="flex items-center gap-1.5">
              <Languages className="h-4 w-4" aria-hidden="true" />
              <dt className="sr-only">{t('fiction.language')}</dt>
              <dd>{formatLanguage(fiction.language)}</dd>
            </div>
          )}
          <div>
            <dt className="sr-only">{t('fiction.length')}</dt>
            <dd>{t('fiction.wordCount', { count: formatNumber(fiction.word_count) })}</dd>
          </div>
          <div>
            <dt className="sr-only">{t('work.rating')}</dt>
            <dd>{ratingLabel(fiction.content_rating)}</dd>
          </div>
          {fiction.published_at && (
            <div>
              <dt className="sr-only">{t('fiction.published')}</dt>
              <dd>{t('fiction.publishedOn', { date: formatDate(fiction.published_at) })}</dd>
            </div>
          )}
        </dl>
      </header>

      <div className="mx-auto max-w-[72ch] pt-9 font-serif">
        <FictionBody body={fiction.body} />
      </div>
    </article>
  );
}
