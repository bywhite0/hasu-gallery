/**
 * ModerationPage - Moderation dashboard for reviewing pending works
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ModeratorGuard } from '../components/ModeratorGuard';
import { ModerationActions } from '../components/ModerationActions';
import { ModerationLog } from '../components/ModerationLog';
import { getModerationQueue } from '../api/moderation';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../i18n';

export function ModerationPage() {
  const {
    t,
    galleryLabel,
    galleryShortLabel,
    statusLabel,
    originLabel,
    formatDateTime,
    formatFileSize,
  } = useI18n();
  const [gallery, setGallery] = useState<'meme' | 'art'>('meme');
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const user = useAuthStore((state) => state.user);
  const canModerate = user?.role === 'moderator' || user?.role === 'admin';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['moderation-queue', gallery, status, page],
    queryFn: () => getModerationQueue({ gallery, status, page, limit: 20 }),
    enabled: canModerate,
  });

  const currentWork = data?.works[0];

  const handleSuccess = () => {
    refetch();
  };

  const handleNext = () => {
    if (data && data.works.length > 1) {
      // Just refetch to get next work
      refetch();
    } else if (data && data.pagination.page < data.pagination.total_pages) {
      setPage(page + 1);
    }
  };

  return (
    <ModeratorGuard>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('moderation.title')}</h1>
            <p className="text-ink/60 mt-2">{t('moderation.description')}</p>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <div>
              <label htmlFor="moderation-gallery-filter" className="block text-sm font-medium mb-2">
                {t('work.gallery')}
              </label>
              <select
                id="moderation-gallery-filter"
                value={gallery}
                onChange={(e) => {
                  setGallery(e.target.value as 'meme' | 'art');
                  setPage(1);
                }}
                className="px-3 py-2 border border-ink/20 rounded-md focus:outline-none focus:ring-2 focus:ring-ink"
              >
                <option value="meme">{galleryLabel('meme')}</option>
                <option value="art">{galleryLabel('art')}</option>
              </select>
            </div>

            <div>
              <label htmlFor="moderation-status-filter" className="block text-sm font-medium mb-2">
                {t('filter.status')}
              </label>
              <select
                id="moderation-status-filter"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border border-ink/20 rounded-md focus:outline-none focus:ring-2 focus:ring-ink"
              >
                <option value="pending">{t('status.pending')}</option>
                <option value="approved">{t('status.approved')}</option>
                <option value="rejected">{t('status.rejected')}</option>
                <option value="takedown">{t('status.takedown')}</option>
              </select>
            </div>
          </div>

          {/* Loading & Error States */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="text-ink/60">{t('moderation.loadingQueue')}</div>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <div className="text-red-600">{t('moderation.queueError')}</div>
            </div>
          )}

          {/* No works */}
          {data && data.works.length === 0 && (
            <div className="text-center py-12">
              <div className="text-ink/60">
                {status === 'pending'
                  ? t('moderation.noPendingSubmissions')
                  : t('moderation.noSubmissions')}
              </div>
            </div>
          )}

          {/* Current work */}
          {currentWork && (
            <div className="border border-ink/20 rounded-lg overflow-hidden">
              {/* Work preview */}
              <div className="bg-ink/5 p-6">
                {currentWork.file_url ? (
                  <img
                    src={currentWork.file_url}
                    alt={currentWork.title}
                    className="max-w-full max-h-96 mx-auto object-contain"
                  />
                  ) : (
                    <div className="h-96 flex items-center justify-center text-ink/40">
                      {t('common.noPreview')}
                    </div>
                  )}
              </div>

              {/* Work metadata */}
              <div className="p-6 space-y-4">
                <div>
                  <h2 className="text-xl font-bold">{currentWork.title}</h2>
                  <div className="text-sm text-ink/60 mt-1">
                    {t('moderation.uploadedBy', { handle: currentWork.uploader_handle })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-ink/60">{t('work.gallery')}:</span>
                    <span className="ml-2">{galleryShortLabel(currentWork.gallery)}</span>
                  </div>
                  <div>
                    <span className="text-ink/60">{t('filter.status')}:</span>
                    <span className="ml-2">{statusLabel(currentWork.status)}</span>
                  </div>
                  {currentWork.origin && (
                    <div>
                      <span className="text-ink/60">{t('work.origin')}:</span>
                      <span className="ml-2">{originLabel(currentWork.origin)}</span>
                    </div>
                  )}
                  {currentWork.dimensions && (
                    <div>
                      <span className="text-ink/60">{t('work.dimensions')}:</span>
                      <span className="ml-2">{currentWork.dimensions}</span>
                    </div>
                  )}
                  {currentWork.file_size_bytes && (
                    <div>
                      <span className="text-ink/60">{t('moderation.fileSize')}:</span>
                      <span className="ml-2">
                        {formatFileSize(currentWork.file_size_bytes)}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-ink/60">{t('moderation.created')}:</span>
                    <span className="ml-2">
                      {formatDateTime(currentWork.created_at)}
                    </span>
                  </div>
                </div>

                {currentWork.source && (
                  <div className="text-sm">
                    <span className="text-ink/60">{t('moderation.sourceNote')}:</span>
                    <span className="ml-2">{currentWork.source}</span>
                  </div>
                )}

                {currentWork.source_url && (
                  <div className="text-sm">
                    <span className="text-ink/60">{t('moderation.sourceUrl')}:</span>
                    <a
                      href={currentWork.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-600 hover:underline"
                    >
                      {currentWork.source_url}
                    </a>
                  </div>
                )}

                {/* Moderation actions (only for pending) */}
                {status === 'pending' && (
                  <div className="border-t border-ink/20 pt-4">
                    <ModerationActions
                      workId={currentWork.id}
                      onSuccess={handleSuccess}
                    />
                  </div>
                )}

                {/* Moderation log */}
                {status !== 'pending' && (
                  <div className="border-t border-ink/20 pt-4">
                    <ModerationLog workId={currentWork.id} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pagination info */}
          {data && data.works.length > 0 && (
            <div className="text-center text-sm text-ink/60">
              {t('moderation.pageSummary', {
                current: data.pagination.page,
                total: data.pagination.total_pages,
                count: data.pagination.total,
              })}
            </div>
          )}
        </div>
      </div>
    </ModeratorGuard>
  );
}
