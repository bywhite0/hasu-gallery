/**
 * ModerationPage - Moderation dashboard for reviewing pending works
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select } from '@hasu-gallery/ui';
import { ModeratorGuard } from '../components/ModeratorGuard';
import { ModerationActions } from '../components/ModerationActions';
import { ModerationLog } from '../components/ModerationLog';
import { FictionModerationPanel } from '../components/FictionModerationPanel';
import { Pagination } from '../components/Pagination';
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
  const [queueKind, setQueueKind] = useState<'media' | 'fiction'>('media');
  const [gallery, setGallery] = useState<'meme' | 'art'>('meme');
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const user = useAuthStore((state) => state.user);
  const canModerate = user?.role === 'moderator' || user?.role === 'admin';

  // The queue is reviewed one submission at a time: each server-side "page"
  // holds exactly one work, so page navigation moves through the queue and a
  // decision on a pending item pulls the next one into the same position.
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['moderation-queue', gallery, status, page],
    queryFn: () => getModerationQueue({ gallery, status, page, limit: 1 }),
    enabled: canModerate && queueKind === 'media',
  });

  const currentWork = data?.works[0];

  // Deciding the last item of the queue shrinks total_pages below the
  // current page; clamp so the moderator lands on the new last item.
  useEffect(() => {
    if (!data) return;
    const maxPage = Math.max(1, data.pagination.total_pages);
    if (page > maxPage) setPage(maxPage);
  }, [data, page]);

  const handleSuccess = () => {
    refetch();
  };

  return (
    <ModeratorGuard>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('moderation.title')}</h1>
          </div>

          <div className="flex flex-wrap gap-4">
            <div>
              <label htmlFor="moderation-queue-kind" className="block text-sm font-medium mb-2">
                {t('moderation.queueKind')}
              </label>
              <Select
                id="moderation-queue-kind"
                className="w-auto"
                value={queueKind}
                onChange={(e) => {
                  setQueueKind(e.target.value as 'media' | 'fiction');
                  setPage(1);
                }}
              >
                <option value="media">{t('moderation.queueMedia')}</option>
                <option value="fiction">{t('moderation.queueFiction')}</option>
              </Select>
            </div>

            {queueKind === 'media' && (
              <>
                <div>
                  <label htmlFor="moderation-gallery-filter" className="block text-sm font-medium mb-2">
                    {t('work.gallery')}
                  </label>
                  <Select
                    id="moderation-gallery-filter"
                    className="w-auto"
                    value={gallery}
                    onChange={(e) => {
                      setGallery(e.target.value as 'meme' | 'art');
                      setPage(1);
                    }}
                  >
                    <option value="meme">{galleryLabel('meme')}</option>
                    <option value="art">{galleryLabel('art')}</option>
                  </Select>
                </div>

                <div>
                  <label htmlFor="moderation-status-filter" className="block text-sm font-medium mb-2">
                    {t('filter.status')}
                  </label>
                  <Select
                    id="moderation-status-filter"
                    className="w-auto"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="pending">{t('status.pending')}</option>
                    <option value="approved">{t('status.approved')}</option>
                    <option value="rejected">{t('status.rejected')}</option>
                    <option value="takedown">{t('status.takedown')}</option>
                  </Select>
                </div>
              </>
            )}
          </div>

          {queueKind === 'fiction' ? (
            <FictionModerationPanel />
          ) : (
            <>
              {isLoading && (
                <div className="text-center py-12">
                  <div className="text-ink/60">{t('moderation.loadingQueue')}</div>
                </div>
              )}

              {error && (
                <div className="text-center py-12">
                  <div className="text-danger">{t('moderation.queueError')}</div>
                </div>
              )}

              {data && data.works.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-ink/60">
                    {status === 'pending'
                      ? t('moderation.noPendingSubmissions')
                      : t('moderation.noSubmissions')}
                  </div>
                </div>
              )}

              {currentWork && (
                <div className="border border-ink/20 rounded-lg overflow-hidden">
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
                          className="ml-2 text-info underline underline-offset-4 hover:text-ink"
                        >
                          {currentWork.source_url}
                        </a>
                      </div>
                    )}

                    {status === 'pending' && (
                      <div className="border-t border-ink/20 pt-4">
                        <ModerationActions
                          workId={currentWork.id}
                          onSuccess={handleSuccess}
                        />
                      </div>
                    )}

                    {status !== 'pending' && (
                      <div className="border-t border-ink/20 pt-4">
                        <ModerationLog workId={currentWork.id} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {data && data.works.length > 0 && (
                <>
                  {data.pagination.total_pages > 1 && (
                    <Pagination
                      currentPage={page}
                      totalPages={data.pagination.total_pages}
                      onPageChange={setPage}
                    />
                  )}
                  <div className="text-center text-sm text-ink/60">
                    {t('moderation.pageSummary', {
                      current: data.pagination.page,
                      total: data.pagination.total_pages,
                      count: data.pagination.total,
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </ModeratorGuard>
  );
}
