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

export function ModerationPage() {
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
            <h1 className="text-3xl font-bold text-foreground">Moderation</h1>
            <p className="text-ink/60 mt-2">Review pending submissions and keep decisions traceable.</p>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Gallery</label>
              <select
                value={gallery}
                onChange={(e) => {
                  setGallery(e.target.value as 'meme' | 'art');
                  setPage(1);
                }}
                className="px-3 py-2 border border-ink/20 rounded-md focus:outline-none focus:ring-2 focus:ring-ink"
              >
                <option value="meme">Meme Gallery</option>
                <option value="art">Art Gallery</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border border-ink/20 rounded-md focus:outline-none focus:ring-2 focus:ring-ink"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="takedown">Removed</option>
              </select>
            </div>
          </div>

          {/* Loading & Error States */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="text-ink/60">Loading moderation queue...</div>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <div className="text-red-600">Could not load the queue: {(error as Error).message}</div>
            </div>
          )}

          {/* No works */}
          {data && data.works.length === 0 && (
            <div className="text-center py-12">
              <div className="text-ink/60">
                No {status === 'pending' ? 'pending ' : ''}submissions found.
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
                      No preview available
                    </div>
                  )}
              </div>

              {/* Work metadata */}
              <div className="p-6 space-y-4">
                <div>
                  <h2 className="text-xl font-bold">{currentWork.title}</h2>
                  <div className="text-sm text-ink/60 mt-1">
                    Uploaded by @{currentWork.uploader_handle}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-ink/60">Gallery:</span>
                    <span className="ml-2">{currentWork.gallery === 'meme' ? 'Meme' : 'Art'}</span>
                  </div>
                  <div>
                    <span className="text-ink/60">Status:</span>
                    <span className="ml-2">{currentWork.status}</span>
                  </div>
                  {currentWork.origin && (
                    <div>
                      <span className="text-ink/60">Origin:</span>
                      <span className="ml-2">{currentWork.origin}</span>
                    </div>
                  )}
                  {currentWork.dimensions && (
                    <div>
                      <span className="text-ink/60">Dimensions:</span>
                      <span className="ml-2">{currentWork.dimensions}</span>
                    </div>
                  )}
                  {currentWork.file_size_bytes && (
                    <div>
                      <span className="text-ink/60">File size:</span>
                      <span className="ml-2">
                        {(currentWork.file_size_bytes / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-ink/60">Created:</span>
                    <span className="ml-2">
                      {new Date(currentWork.created_at).toLocaleString('en-US')}
                    </span>
                  </div>
                </div>

                {currentWork.source && (
                  <div className="text-sm">
                    <span className="text-ink/60">Source note:</span>
                    <span className="ml-2">{currentWork.source}</span>
                  </div>
                )}

                {currentWork.source_url && (
                  <div className="text-sm">
                    <span className="text-ink/60">Source URL:</span>
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
              Page {data.pagination.page} of {data.pagination.total_pages}
              {' '}({data.pagination.total} submissions)
            </div>
          )}
        </div>
      </div>
    </ModeratorGuard>
  );
}
