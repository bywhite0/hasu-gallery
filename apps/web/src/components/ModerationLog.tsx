/**
 * ModerationLog - Display moderation history for a work
 */

import { useQuery } from '@tanstack/react-query';
import { getModerationLog } from '../api/moderation';

interface ModerationLogProps {
  workId: string;
}

export function ModerationLog({ workId }: ModerationLogProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['moderation-log', workId],
    queryFn: () => getModerationLog(workId),
  });

  if (isLoading) {
    return <div className="text-sm text-ink/60">加载审核历史...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-600">加载失败</div>;
  }

  if (!data || data.logs.length === 0) {
    return <div className="text-sm text-ink/60">暂无审核记录</div>;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">审核历史</h3>
      <div className="space-y-2">
        {data.logs.map((log) => (
          <div
            key={log.id}
            className="border-l-2 border-ink/20 pl-3 py-1 text-sm"
          >
            <div className="flex items-center gap-2">
              <span className={`font-medium ${
                log.action === 'approved' ? 'text-green-600' :
                log.action === 'rejected' ? 'text-red-600' :
                'text-orange-600'
              }`}>
                {log.action === 'approved' ? '✅ 批准' :
                 log.action === 'rejected' ? '❌ 拒绝' :
                 '⚠️ 下架'}
              </span>
              <span className="text-ink/60">by</span>
              <span className="font-medium">@{log.moderator_handle}</span>
            </div>
            {log.note && (
              <div className="text-ink/60 mt-1">"{log.note}"</div>
            )}
            <div className="text-ink/40 text-xs mt-1">
              {new Date(log.created_at).toLocaleString('zh-CN')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
