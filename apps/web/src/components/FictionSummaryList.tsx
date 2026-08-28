import { Link } from '@tanstack/react-router';
import { BookOpenText } from 'lucide-react';
import type { PublicFictionSummary } from '../api/fiction';
import { useI18n } from '../i18n';

interface FictionSummaryListProps {
  items: PublicFictionSummary[];
  compact?: boolean;
}

export function FictionSummaryList({ items, compact = false }: FictionSummaryListProps) {
  const { t, formatLanguage, formatNumber } = useI18n();

  return (
    <div className="divide-y divide-ink/10 border-y border-ink/10">
      {items.map((item) => (
        <article key={item.id} className={compact ? 'py-4' : 'py-5 sm:py-6'}>
          <Link
            to="/fiction/$id"
            params={{ id: item.id }}
            className="group grid min-h-11 gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4 focus-visible:ring-offset-paper sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
          >
            <div className="min-w-0">
              <div className="flex items-start gap-3">
                <BookOpenText className="mt-0.5 h-5 w-5 shrink-0 text-ink-3 transition-colors group-hover:text-ink" aria-hidden="true" />
                <div className="min-w-0">
                  <h2 className={`${compact ? 'text-base' : 'text-lg'} font-semibold leading-6 text-ink group-hover:underline group-hover:underline-offset-4`}>
                    {item.title}
                  </h2>
                  {!compact && item.summary && (
                    <p className="mt-2 line-clamp-3 max-w-3xl text-sm leading-6 text-ink-2">
                      {item.summary}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <dl className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-8 text-xs leading-5 text-ink-2 sm:max-w-72 sm:justify-end sm:pl-0 sm:text-right">
              <div className="contents">
                <dt className="sr-only">{t('fiction.author')}</dt>
                <dd className="font-medium text-ink">@{item.author_handle || t('common.unknown')}</dd>
              </div>
              {item.fandom && (
                <div className="contents">
                  <dt className="sr-only">{t('fiction.fandom')}</dt>
                  <dd>{item.fandom}</dd>
                </div>
              )}
              {item.language && (
                <div className="contents">
                  <dt className="sr-only">{t('fiction.language')}</dt>
                  <dd>{formatLanguage(item.language)}</dd>
                </div>
              )}
              <div className="contents">
                <dt className="sr-only">{t('fiction.length')}</dt>
                <dd>{t('fiction.wordCount', { count: formatNumber(item.word_count) })}</dd>
              </div>
            </dl>
          </Link>
        </article>
      ))}
    </div>
  );
}
