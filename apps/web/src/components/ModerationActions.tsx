/**
 * ModerationActions - Action buttons for moderating works
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@hasu-gallery/ui';
import { updateWorkStatus } from '../api/moderation';

interface ModerationActionsProps {
  workId: string;
  onSuccess: () => void;
}

export function ModerationActions({ workId, onSuccess }: ModerationActionsProps) {
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: ({ status, note }: { status: 'approved' | 'rejected' | 'takedown'; note?: string }) =>
      updateWorkStatus(workId, { status, note }),
    onSuccess: () => {
      setNote('');
      onSuccess();
    },
  });

  const handleApprove = () => {
    if (!confirm('确认批准这个作品？')) return;
    mutation.mutate({ status: 'approved', note: note || undefined });
  };

  const handleReject = () => {
    if (!confirm('确认拒绝这个作品？')) return;
    mutation.mutate({ status: 'rejected', note: note || undefined });
  };

  const handleTakedown = () => {
    if (!confirm('确认下架这个作品？此操作不可逆！')) return;
    mutation.mutate({ status: 'takedown', note: note || undefined });
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="note" className="block text-sm font-medium mb-2">
          审核理由（可选）
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="输入审核理由..."
          className="w-full px-3 py-2 border border-ink/20 rounded-md focus:outline-none focus:ring-2 focus:ring-ink"
          rows={3}
          disabled={mutation.isPending}
        />
      </div>

      <div className="flex gap-3">
        <Button
          onClick={handleApprove}
          disabled={mutation.isPending}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {mutation.isPending ? '处理中...' : '✓ 批准'}
        </Button>

        <Button
          onClick={handleReject}
          disabled={mutation.isPending}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          {mutation.isPending ? '处理中...' : '✗ 拒绝'}
        </Button>

        <Button
          onClick={handleTakedown}
          disabled={mutation.isPending}
          variant="outline"
        >
          {mutation.isPending ? '处理中...' : '⚠ 下架'}
        </Button>
      </div>

      {mutation.isError && (
        <div className="text-red-600 text-sm">
          操作失败：{(mutation.error as Error).message}
        </div>
      )}
    </div>
  );
}
