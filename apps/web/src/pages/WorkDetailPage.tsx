import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useNavigate, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button, ErrorState, StateMessage } from '@hasu-gallery/ui';
import { getWork } from '../api/works';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';
import { useI18n } from '../i18n';
import { reportClientError } from '../lib/errorReporting';
import { isNetworkError } from '../lib/network';
import { UserBadge, type PublicUserIdentity } from '../components/UserIdentity';

const getErrorDescription = (error: unknown, t: ReturnType<typeof useI18n>['t']) => {
  if (isNetworkError(error)) {
    return t('work.errorNetwork');
  }

  return t('work.errorFallback');
};

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <h2 className="text-xs font-semibold uppercase tracking-normal text-ink-3">{label}</h2>
      <div className="text-sm leading-6 text-ink">{children}</div>
    </div>
  );
}

export function WorkDetailPage() {
  const { t, galleryLabel, originLabel, ratingLabel, publicStatusLabel, formatDate } = useI18n();
  const { id } = useParams({ strict: false });
  const navigate = useNavigate();
  const [imageFailed, setImageFailed] = useState(false);

  const {
    data: work,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['work', id],
    queryFn: () => getWork(id as string),
    enabled: !!id,
  });
  const errorReport = error
    ? reportClientError(error, { area: 'work-detail', details: { id } })
    : null;

  // Fiction uses its own reader/workspace routes; never treat it as image
  // work detail. Navigation is a side effect, so it must not run in render.
  useEffect(() => {
    if (!work || work.gallery !== 'fiction') return;
    if (work.status === 'approved') {
      void navigate({ to: '/fiction/$id', params: { id: work.id } });
    } else {
      void navigate({ to: '/profile/fictions' });
    }
  }, [work, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <StateMessage
          title={t('work.loadingTitle')}
          tone="info"
        />
      </div>
    );
  }

  if (error || !work) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <ErrorState
          title={t('work.unavailableTitle')}
          description={
            <div className="space-y-1">
              <p>{getErrorDescription(error, t)}</p>
              {errorReport && <p>{t('error.reference', { reference: errorReport.reference })}</p>}
            </div>
          }
          action={
            <>
              <Button type="button" onClick={() => void refetch()} disabled={isFetching}>
                {isFetching ? t('common.retrying') : t('common.retry')}
              </Button>
              <Link to="/gallery/meme">
                <Button type="button" variant="outline">
                  {t('work.backToGallery', { gallery: t('gallery.meme') })}
                </Button>
              </Link>
            </>
          }
        />
      </div>
    );
  }

  // Fiction 重定向由上面的 effect 处理；渲染期间只显示占位状态。
  if (work.gallery === 'fiction') {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <StateMessage title={t('work.loadingTitle')} tone="info" />
      </div>
    );
  }

  const handleDownload = () => {
    if (!work.file_url) return;
    const link = document.createElement('a');
    link.href = work.file_url;
    link.download = work.file_url.split('/').pop() || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasImage = Boolean(work.file_url) && !imageFailed;
  const title = work.title || t('work.untitled');
  const galleryName = galleryLabel(work.gallery);
  const uploaderIdentity: PublicUserIdentity | null = work.uploader
    ? {
        displayName: work.uploader.display_name,
        handle: work.uploader.handle,
        joinedAt: work.uploader.joined_at,
        publicWorkCount: work.uploader.approved_public_work_count,
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: `/gallery/${work.gallery}` })}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('work.backToGallery', { gallery: galleryName })}
        </Button>
        {work.status !== 'approved' && (
          <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
            {publicStatusLabel(work.status)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-md border border-ink/15 bg-surface">
            {hasImage ? (
              <img
                src={work.file_url}
                alt={title}
                className="mx-auto max-h-[72vh] w-full object-contain"
                loading="eager"
                decoding="async"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <div className="flex min-h-[24rem] items-center justify-center px-6 text-center text-sm text-ink-2">
                {t('common.imageUnavailable')}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6 rounded-md border border-ink/15 bg-surface p-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-normal text-ink-3">
              {galleryName}
            </p>
            <h1 className="text-2xl font-semibold leading-tight text-ink">{title}</h1>
          </div>

          <div className="space-y-5">
            <InfoRow label={t('work.dimensions')}>
              {work.width} × {work.height}
            </InfoRow>

            <InfoRow label={t('work.gallery')}>
              <Link
                to={`/gallery/${work.gallery}`}
                className="font-medium text-info underline underline-offset-4 hover:text-ink"
              >
                {galleryName}
              </Link>
            </InfoRow>

            {work.origin && <InfoRow label={t('work.origin')}>{originLabel(work.origin)}</InfoRow>}

            {work.art_meta && (
              <>
                <InfoRow label={t('work.artist')}>{work.art_meta.artist}</InfoRow>
                {work.art_meta.medium && (
                  <InfoRow label={t('work.medium')}>{work.art_meta.medium}</InfoRow>
                )}
                <InfoRow label={t('work.rating')}>{ratingLabel(work.art_meta.rating)}</InfoRow>
              </>
            )}

            {(uploaderIdentity || work.uploader_name) && (
              <InfoRow label={t('work.submittedBy')}>
                {uploaderIdentity ? <UserBadge identity={uploaderIdentity} /> : work.uploader_name}
              </InfoRow>
            )}

            {work.source_url && (
              <InfoRow label={t('work.source')}>
                <a
                  href={work.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-info underline underline-offset-4 hover:text-ink"
                >
                  {t('work.viewSource')}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </InfoRow>
            )}

            {work.rights_note && (
              <InfoRow label={t('work.rights')}>{work.rights_note}</InfoRow>
            )}

            <InfoRow label={t('work.uploaded')}>
              {formatDate(work.created_at)}
            </InfoRow>
          </div>

          <Button onClick={handleDownload} className="w-full gap-2" disabled={!work.file_url}>
            <Download className="h-4 w-4" />
            {work.file_url ? t('work.download') : t('work.fileUnavailable')}
          </Button>
        </aside>
      </div>
    </div>
  );
}
