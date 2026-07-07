import { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, ImageOff, XCircle } from 'lucide-react';
import { Button } from '@hasu-gallery/ui';
import type { WorkListItem, WorkStatus } from '@hasu-gallery/types';
import { useI18n, type TranslationKey } from '../i18n';

interface MyWorksListProps {
  works: WorkListItem[];
  onWorkClick: (id: string) => void;
}

const statusConfig = {
  pending: {
    icon: Clock,
    className: 'border-warning/30 bg-warning/10 text-warning',
  },
  approved: {
    icon: CheckCircle,
    className: 'border-success/30 bg-success/10 text-success',
  },
  rejected: {
    icon: XCircle,
    className: 'border-danger/30 bg-danger/10 text-danger',
  },
  takedown: {
    icon: AlertTriangle,
    className: 'border-ink/20 bg-ink/5 text-ink-2',
  },
} as const satisfies Record<WorkStatus, {
  icon: typeof Clock;
  className: string;
}>;

const actionKeys = {
  pending: 'profile.actionWait',
  approved: 'profile.actionOpenPublished',
  rejected: 'profile.actionReviewNote',
  takedown: 'profile.actionContactReview',
} as const satisfies Record<WorkStatus, TranslationKey>;

function WorkThumbnail({ work, onOpen }: { work: WorkListItem; onOpen: () => void }) {
  const { t } = useI18n();
  const [imageFailed, setImageFailed] = useState(false);
  const hasThumbnail = Boolean(work.thumbnail_url) && !imageFailed;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="h-24 w-24 shrink-0 overflow-hidden rounded-md border border-ink/10 bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper sm:h-28 sm:w-28"
    >
      {hasThumbnail ? (
        <img
          src={work.thumbnail_url}
          alt={t('home.thumbnailAlt', { title: work.title })}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-ink-2">
          <ImageOff className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
    </button>
  );
}

export function MyWorksList({ works, onWorkClick }: MyWorksListProps) {
  const { t, galleryShortLabel, publicStatusLabel, formatDate } = useI18n();

  if (works.length === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-md border border-dashed border-ink/20 bg-surface px-4 text-center">
        <p className="text-sm text-ink-2">{t('profile.noWorks')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {works.map((work) => {
        const config = statusConfig[work.status];
        const Icon = config.icon;
        const createdDate = formatDate(work.created_at);
        const reviewedDate = work.reviewed_at ? formatDate(work.reviewed_at) : null;
        const note = work.review_note?.trim();

        return (
          <article
            key={work.id}
            className="flex flex-col gap-4 rounded-md border border-ink/10 bg-surface p-3 shadow-sm sm:flex-row sm:p-4"
          >
            <WorkThumbnail work={work} onOpen={() => onWorkClick(work.id)} />

            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-normal text-ink-2">
                    {galleryShortLabel(work.gallery)}
                  </p>
                  <h3 className="text-base font-semibold leading-6 text-ink">{work.title}</h3>
                </div>
                <span className={`inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${config.className}`}>
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  {publicStatusLabel(work.status)}
                </span>
              </div>

              <dl className="grid gap-2 text-sm text-ink-2 sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-ink">{t('profile.submittedOn')}</dt>
                  <dd>{createdDate}</dd>
                </div>
                {reviewedDate && (
                  <div>
                    <dt className="font-medium text-ink">{t('profile.reviewedOn')}</dt>
                    <dd>{reviewedDate}</dd>
                  </div>
                )}
              </dl>

              {(note || work.status === 'rejected' || work.status === 'takedown') && (
                <div className="rounded-md border border-ink/10 bg-paper p-3 text-sm">
                  <p className="font-medium text-ink">{t('profile.reviewNote')}</p>
                  <p className="mt-1 text-ink-2">{note || t('profile.noReviewNote')}</p>
                </div>
              )}

              <div className="flex flex-col gap-3 border-t border-ink/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink-2">
                  <span className="font-medium text-ink">{t('profile.nextAction')}:</span>{' '}
                  {t(actionKeys[work.status])}
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => onWorkClick(work.id)}>
                  {t('profile.openWork')}
                </Button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
