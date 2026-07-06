import { useState, type ReactNode } from 'react';
import { useParams, useNavigate, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button, ErrorState, StateMessage } from '@hasu-gallery/ui';
import { getWork } from '../api/works';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';

const galleryLabel = {
  meme: 'Meme Gallery',
  art: 'Art Gallery',
} as const;

const originLabel = {
  official: 'Official',
  derived: 'Derived',
  fan_made: 'Fan made',
} as const;

const ratingLabel = {
  all_ages: 'All Ages',
  r15: 'R-15',
  r18: 'R-18',
} as const;

const statusLabel = {
  pending: 'Waiting for review',
  approved: 'Published',
  rejected: 'Not accepted',
  takedown: 'Removed',
} as const;

const getErrorDescription = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';

  if (message === 'Failed to fetch') {
    return 'The gallery is not reachable right now. Please try again in a moment.';
  }

  return message || 'This work could not be opened. It may have been removed or the link may be out of date.';
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

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <StateMessage
          title="Loading work"
          description="Fetching the image and details for this public gallery item."
          tone="info"
        />
      </div>
    );
  }

  if (error || !work) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <ErrorState
          title="Work unavailable"
          description={getErrorDescription(error)}
          action={
            <>
              <Button type="button" onClick={() => void refetch()} disabled={isFetching}>
                {isFetching ? 'Retrying...' : 'Retry'}
              </Button>
              <Link to="/gallery/meme">
                <Button type="button" variant="outline">
                  Back to Meme Gallery
                </Button>
              </Link>
            </>
          }
        />
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
  const title = work.title || 'Untitled work';
  const galleryName = galleryLabel[work.gallery];

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
          Back to {galleryName}
        </Button>
        {work.status !== 'approved' && (
          <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
            {statusLabel[work.status]}
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
                Image unavailable
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
            <InfoRow label="Dimensions">
              {work.width} × {work.height}
            </InfoRow>

            <InfoRow label="Gallery">
              <Link
                to={`/gallery/${work.gallery}`}
                className="font-medium text-info underline underline-offset-4 hover:text-ink"
              >
                {galleryName}
              </Link>
            </InfoRow>

            {work.origin && (
              <InfoRow label="Origin">{originLabel[work.origin]}</InfoRow>
            )}

            {work.art_meta && (
              <>
                <InfoRow label="Artist">{work.art_meta.artist}</InfoRow>
                {work.art_meta.medium && (
                  <InfoRow label="Medium">{work.art_meta.medium}</InfoRow>
                )}
                <InfoRow label="Rating">{ratingLabel[work.art_meta.rating]}</InfoRow>
              </>
            )}

            {work.uploader_name && <InfoRow label="Submitted by">{work.uploader_name}</InfoRow>}

            {work.source_url && (
              <InfoRow label="Source">
                <a
                  href={work.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-info underline underline-offset-4 hover:text-ink"
                >
                  View source
                  <ExternalLink className="h-3 w-3" />
                </a>
              </InfoRow>
            )}

            {work.rights_note && (
              <InfoRow label="Rights">{work.rights_note}</InfoRow>
            )}

            <InfoRow label="Uploaded">
              {new Date(work.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </InfoRow>
          </div>

          <Button onClick={handleDownload} className="w-full gap-2" disabled={!work.file_url}>
            <Download className="h-4 w-4" />
            {work.file_url ? 'Download' : 'File unavailable'}
          </Button>
        </aside>
      </div>
    </div>
  );
}
