import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { WorkListItem } from '@hasu-gallery/types';
import { useI18n } from '../i18n';

interface WorkCardProps {
  work: WorkListItem;
}

export function WorkCard({ work }: WorkCardProps) {
  const { t, originLabel, statusLabel } = useI18n();
  const [imageFailed, setImageFailed] = useState(false);
  const hasThumbnail = Boolean(work.thumbnail_url) && !imageFailed;
  const meta = [
    `${work.width} x ${work.height}`,
    work.origin ? originLabel(work.origin) : null,
  ].filter(Boolean);

  return (
    <Link
      to="/works/$id"
      params={{ id: work.id }}
      className="group block overflow-hidden rounded-md border border-ink/15 bg-surface shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
    >
      <div className="aspect-square overflow-hidden bg-accent/40">
        {hasThumbnail ? (
          <img
            src={work.thumbnail_url}
            alt={t('home.thumbnailAlt', { title: work.title })}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-ink-2">
            {t('common.imageUnavailable')}
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 text-sm font-semibold leading-5 text-ink">
            {work.title}
          </h3>
          {work.status !== 'approved' && (
            <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
              {statusLabel(work.status)}
            </span>
          )}
        </div>
        <p className="text-xs leading-5 text-ink-2">{meta.join(' · ')}</p>
      </div>
    </Link>
  );
}
