/**
 * FictionModerationPanel - Review pending Fiction revisions via the JSON API.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenText, CheckCircle2, XCircle } from 'lucide-react';
import { Button, EmptyState, ErrorState, Field, FormMessage, Textarea } from '@hasu-gallery/ui';
import {
  decideFictionRevision,
  listFictionModerationQueue,
  type FictionRevision,
} from '../api/fiction';
import { FictionBody } from './FictionBody';
import { useI18n } from '../i18n';
import { fictionErrorKey } from '../lib/fiction';
type Decision = 'approve' | 'reject';

export function FictionModerationPanel() {
  const { t, formatDateTime, formatNumber, ratingLabel } = useI18n();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null);

  const queueQuery = useQuery({
    queryKey: ['moderation-queue', 'fiction'],
    queryFn: listFictionModerationQueue,
  });

  const current = queueQuery.data?.[0] as FictionRevision | undefined;

  const decisionMutation = useMutation({
    mutationFn: ({
      workId,
      revisionId,
      approve,
      note,
    }: {
      workId: string;
      revisionId: string;
      approve: boolean;
      note: string;
    }) => decideFictionRevision(workId, revisionId, approve, note),
    onSuccess: async () => {
      setNote('');
      setPendingDecision(null);
      await queryClient.invalidateQueries({ queryKey: ['moderation-queue', 'fiction'] });
    },
  });

  const confirm = () => {
    if (!current || !pendingDecision) return;
    decisionMutation.mutate({
      workId: current.fiction_id,
      revisionId: current.id,
      approve: pendingDecision === 'approve',
      note: note.trim(),
    });
  };

  const errorKey = useMemo(
    () =>
      decisionMutation.error
        ? fictionErrorKey(decisionMutation.error, 'moderation.updateFailed')
        : queueQuery.error
          ? fictionErrorKey(queueQuery.error, 'moderation.fictionQueueError')
          : null,
    [decisionMutation.error, queueQuery.error],
  );

  if (queueQuery.isLoading) {
    return (
      <div className="rounded-lg border border-ink/15 px-4 py-12 text-center text-ink-2" aria-busy="true">
        {t('moderation.fictionLoading')}
      </div>
    );
  }

  if (queueQuery.error) {
    return (
      <ErrorState
        title={t('moderation.fictionQueueError')}
        description={errorKey ? t(errorKey) : t('moderation.fictionQueueError')}
        action={
          <Button type="button" onClick={() => void queueQuery.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }

  if (!current) {
    return (
      <EmptyState
        title={t('moderation.fictionQueueEmpty')}
        className="min-h-48 rounded-lg border border-ink/15"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-lg border border-ink/15">
        <div className="space-y-4 border-b border-ink/10 bg-surface px-5 py-5">
          <div className="flex items-start gap-3">
            <BookOpenText className="mt-1 h-5 w-5 shrink-0 text-ink-2" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-ink">{current.title}</h2>
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
                <div>
                  <dt className="sr-only">{t('moderation.fictionRevision', { number: current.revision_number })}</dt>
                  <dd>{t('moderation.fictionRevision', { number: current.revision_number })}</dd>
                </div>
                <div>
                  <dt className="sr-only">{t('fiction.length')}</dt>
                  <dd>{t('moderation.fictionWordCount', { count: formatNumber(current.word_count) })}</dd>
                </div>
                <div>
                  <dt className="sr-only">{t('work.rating')}</dt>
                  <dd>{ratingLabel(current.content_rating)}</dd>
                </div>
                {current.created_at && (
                  <div>
                    <dt className="sr-only">{t('moderation.created')}</dt>
                    <dd>{formatDateTime(current.created_at)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {current.plain_text_excerpt && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                {t('moderation.fictionExcerpt')}
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink-2">{current.plain_text_excerpt}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-6">
          <FictionBody body={current.body} />
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-ink/15 p-5">
        <Field label={t('moderation.reviewNote')} htmlFor="fiction-review-note">
          <Textarea
            id="fiction-review-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('moderation.reviewNotePlaceholder')}
            maxLength={1000}
            className="min-h-24"
            disabled={decisionMutation.isPending}
          />
        </Field>

        {decisionMutation.error && (
          <FormMessage>{errorKey ? t(errorKey) : t('moderation.updateFailed')}</FormMessage>
        )}

        {!pendingDecision && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="min-h-11" onClick={() => setPendingDecision('approve')}>
              <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('moderation.approve')}
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setPendingDecision('reject')}>
              <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('moderation.reject')}
            </Button>
          </div>
        )}

        {pendingDecision && (
          <section className="rounded-md border border-warning/30 bg-warning/5 p-4" aria-live="polite">
            <h3 className="font-semibold text-ink">
              {pendingDecision === 'approve'
                ? t('moderation.fictionApproveTitle')
                : t('moderation.fictionRejectTitle')}
            </h3>
            <p className="mt-1 text-sm leading-6 text-ink-2">
              {pendingDecision === 'approve'
                ? t('moderation.fictionApproveDescription')
                : t('moderation.fictionRejectDescription')}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={confirm} disabled={decisionMutation.isPending}>
                {decisionMutation.isPending
                  ? t('moderation.processing')
                  : pendingDecision === 'approve'
                    ? t('moderation.fictionApproveConfirm')
                    : t('moderation.fictionRejectConfirm')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPendingDecision(null)}
                disabled={decisionMutation.isPending}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </section>
        )}

        {queueQuery.data && queueQuery.data.length > 1 && (
          <p className="text-xs text-ink-3">
            {t('moderation.pageSummary', {
              current: 1,
              total: 1,
              count: formatNumber(queueQuery.data.length),
            })}
          </p>
        )}
      </div>
    </div>
  );
}
