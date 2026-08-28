/**
 * ModerationLog - Display moderation history for a work
 */

import { useQuery } from '@tanstack/react-query';
import { getModerationLog } from '../api/moderation';
import { useI18n } from '../i18n';

interface ModerationLogProps {
  workId: string;
}

export function ModerationLog({ workId }: ModerationLogProps) {
  const { t, statusLabel, formatDateTime } = useI18n();
  const { data, isLoading, error } = useQuery({
    queryKey: ['moderation-log', workId],
    queryFn: () => getModerationLog(workId),
  });

  if (isLoading) {
    return <div className="text-sm text-ink/60">{t('moderation.loadingHistory')}</div>;
  }

  if (error) {
    return <div className="text-sm text-danger">{t('moderation.historyError')}</div>;
  }

  if (!data || data.logs.length === 0) {
    return <div className="text-sm text-ink/60">{t('moderation.noHistory')}</div>;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t('moderation.historyTitle')}</h3>
      <div className="space-y-2" role="list">
        {data.logs.map((log) => (
          <div
            key={log.id}
            role="listitem"
            className="rounded-md border border-ink/15 px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-2">
              <span className={`font-medium ${
                log.action === 'approved' ? 'text-success' :
                log.action === 'rejected' ? 'text-danger' :
                'text-orange-600'
              }`}>
                {statusLabel(log.action)}
              </span>
              <span className="text-ink/60">{t('moderation.by')}</span>
              <span className="font-medium">@{log.moderator_handle}</span>
            </div>
            {log.note && (
              <div className="text-ink/60 mt-1">{t('moderation.historyNote', { note: log.note })}</div>
            )}
            <div className="text-ink/40 text-xs mt-1">
              {formatDateTime(log.created_at)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
