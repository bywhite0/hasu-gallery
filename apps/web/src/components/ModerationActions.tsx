/**
 * ModerationActions - Action buttons for moderating works
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@hasu-gallery/ui';
import { Ban, CheckCircle2, XCircle } from 'lucide-react';
import { updateWorkStatus } from '../api/moderation';

interface ModerationActionsProps {
  workId: string;
  onSuccess: () => void;
}

type ModerationStatus = 'approved' | 'rejected' | 'takedown';

interface PendingAction {
  status: ModerationStatus;
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
}

const actions: PendingAction[] = [
  {
    status: 'approved',
    label: 'Approve',
    title: 'Approve this work?',
    description: 'The work will become eligible for the public gallery.',
    confirmLabel: 'Confirm approval',
  },
  {
    status: 'rejected',
    label: 'Reject',
    title: 'Reject this work?',
    description: 'The uploader will see that this submission was not accepted.',
    confirmLabel: 'Confirm rejection',
  },
  {
    status: 'takedown',
    label: 'Remove',
    title: 'Remove this work from the gallery?',
    description: 'Use this only for policy, rights, or safety issues. Add a note so the decision is traceable.',
    confirmLabel: 'Confirm removal',
  },
];

export function ModerationActions({ workId, onSuccess }: ModerationActionsProps) {
  const [note, setNote] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const mutation = useMutation({
    mutationFn: ({ status, note }: { status: ModerationStatus; note?: string }) =>
      updateWorkStatus(workId, { status, note }),
    onSuccess: () => {
      setNote('');
      setPendingAction(null);
      onSuccess();
    },
  });

  const confirmPendingAction = () => {
    if (!pendingAction) return;
    mutation.mutate({ status: pendingAction.status, note: note.trim() || undefined });
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="note" className="block text-sm font-medium mb-2">
          Review note (optional)
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add context for the uploader or future reviewers."
          className="w-full px-3 py-2 border border-ink/20 rounded-md focus:outline-none focus:ring-2 focus:ring-ink"
          rows={3}
          disabled={mutation.isPending}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        {actions.map((action) => {
          const Icon =
            action.status === 'approved' ? CheckCircle2 :
            action.status === 'rejected' ? XCircle :
            Ban;
          const isDanger = action.status !== 'approved';

          return (
            <Button
              key={action.status}
              type="button"
              onClick={() => setPendingAction(action)}
              disabled={mutation.isPending}
              variant={action.status === 'approved' ? 'default' : 'outline'}
              className={isDanger ? 'border-danger text-danger hover:bg-danger/10' : undefined}
              aria-expanded={pendingAction?.status === action.status}
            >
              <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
              {action.label}
            </Button>
          );
        })}
      </div>

      {pendingAction && (
        <div className="rounded-lg border border-ink/20 bg-accent/40 p-4 space-y-3" role="group" aria-labelledby="moderation-confirm-title">
          <div>
            <h3 id="moderation-confirm-title" className="text-sm font-semibold text-foreground">
              {pendingAction.title}
            </h3>
            <p className="mt-1 text-sm text-ink/70">
              {pendingAction.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={confirmPendingAction}
              disabled={mutation.isPending}
              className={pendingAction.status === 'approved' ? undefined : 'bg-danger text-paper hover:bg-danger/90'}
            >
              {mutation.isPending ? 'Processing...' : pendingAction.confirmLabel}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPendingAction(null)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {mutation.isError && (
        <div role="alert" className="text-red-600 text-sm">
          Review update failed: {(mutation.error as Error).message}
        </div>
      )}
    </div>
  );
}
