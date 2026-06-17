/**
 * ModerationPage - Moderation dashboard for reviewing pending works
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ModeratorGuard } from '../components/ModeratorGuard';
import { ModerationActions } from '../components/ModerationActions';
import { ModerationLog } from '../components/ModerationLog';
import { getModerationQueue } from '../api/moderation';

export function ModerationPage() {
  const [gallery, setGallery] = useState<'meme' | 'art'>('meme');
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['moderation-queue', gallery, status, page],
    queryFn: () => getModerationQueue({ gallery, status, page, limit: 20 }),
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
            <h1 className="text-3xl font-bold text-foreground">审核仪表板</h1>
            <p className="text-ink/60 mt-2">审核待处理的作品</p>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">画廊</label>
              <select
                value={gallery}
                onChange={(e) => {
                  setGallery(e.target.value as 'meme' | 'art');
                  setPage(1);
                }}
                className="px-3 py-2 border border-ink/20 rounded-md focus:outline-none focus:ring-2 focus:ring-ink"
              >
                <option value="meme">Meme 画廊</option>
                <option value="art">Art 画廊</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">状态</label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border border-ink/20 rounded-md focus:outline-none focus:ring-2 focus:ring-ink"
              >
                <option value="pending">待审核</option>
                <option value="approved">已批准</option>
                <option value="rejected">已拒绝</option>
                <option value="takedown">已下架</option>
              </select>
            </div>
          </div>

          {/* Loading & Error States */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="text-ink/60">加载中...</div>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <div className="text-red-600">加载失败：{(error as Error).message}</div>
            </div>
          )}

          {/* No works */}
          {data && data.works.length === 0 && (
            <div className="text-center py-12">
              <div className="text-ink/60">暂无{status === 'pending' ? '待审核' : ''}作品</div>
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
                    无预览图
                  </div>
                )}
              </div>

              {/* Work metadata */}
              <div className="p-6 space-y-4">
                <div>
                  <h2 className="text-xl font-bold">{currentWork.title}</h2>
                  <div className="text-sm text-ink/60 mt-1">
                    上传者: @{currentWork.uploader_handle}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-ink/60">画廊：</span>
                    <span className="ml-2">{currentWork.gallery === 'meme' ? 'Meme' : 'Art'}</span>
                  </div>
                  <div>
                    <span className="text-ink/60">状态：</span>
                    <span className="ml-2">{currentWork.status}</span>
                  </div>
                  {currentWork.origin && (
                    <div>
                      <span className="text-ink/60">来源：</span>
                      <span className="ml-2">{currentWork.origin}</span>
                    </div>
                  )}
                  {currentWork.dimensions && (
                    <div>
                      <span className="text-ink/60">尺寸：</span>
                      <span className="ml-2">{currentWork.dimensions}</span>
                    </div>
                  )}
                  {currentWork.file_size_bytes && (
                    <div>
                      <span className="text-ink/60">文件大小：</span>
                      <span className="ml-2">
                        {(currentWork.file_size_bytes / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-ink/60">创建时间：</span>
                    <span className="ml-2">
                      {new Date(currentWork.created_at).toLocaleString('zh-CN')}
                    </span>
                  </div>
                </div>

                {currentWork.source && (
                  <div className="text-sm">
                    <span className="text-ink/60">来源说明：</span>
                    <span className="ml-2">{currentWork.source}</span>
                  </div>
                )}

                {currentWork.source_url && (
                  <div className="text-sm">
                    <span className="text-ink/60">来源链接：</span>
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
              第 {data.pagination.page} / {data.pagination.total_pages} 页
              （共 {data.pagination.total} 个作品）
            </div>
          )}
        </div>
      </div>
    </ModeratorGuard>
  );
}
