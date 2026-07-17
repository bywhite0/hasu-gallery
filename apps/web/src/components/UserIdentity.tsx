import { useId, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import { CalendarDays, Images, Link as LinkIcon } from 'lucide-react';
import { cn } from '@hasu-gallery/ui';
import { useI18n } from '../i18n';

export interface PublicUserIdentity {
  displayName?: string | null;
  handle: string;
  joinedAt?: string | null;
  publicWorkCount?: number;
}

export interface UserAvatarProps {
  identity: PublicUserIdentity;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export interface UserProfileCardProps {
  identity: PublicUserIdentity;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export interface UserBadgeProps {
  identity: PublicUserIdentity;
  className?: string;
  showPreview?: boolean;
}

const avatarSizeClass = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-base',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-24 w-24 text-3xl',
} as const;

function getDisplayName(identity: PublicUserIdentity) {
  return identity.displayName?.trim() || identity.handle;
}

function getInitials(identity: PublicUserIdentity) {
  const displayName = getDisplayName(identity);
  const words = displayName
    .replace(/[^a-zA-Z0-9_\-\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return displayName.slice(0, 2).toUpperCase();
}

export function UserAvatar({ identity, size = 'md', className }: UserAvatarProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-ink/10 bg-accent font-semibold text-ink',
        avatarSizeClass[size],
        className,
      )}
      aria-hidden="true"
    >
      {getInitials(identity)}
    </span>
  );
}

export function UserProfileCard({ identity, action, className, compact = false }: UserProfileCardProps) {
  const { t, formatDate, formatNumber } = useI18n();
  const displayName = getDisplayName(identity);
  const joined = identity.joinedAt ? formatDate(identity.joinedAt) : t('common.unknown');
  const publicWorkCount = Number(identity.publicWorkCount ?? 0);

  return (
    <article className={cn('rounded-md border border-ink/10 bg-surface p-4 text-left shadow-sm', className)}>
      <div className="flex items-start gap-3">
        <UserAvatar identity={identity} size={compact ? 'md' : 'lg'} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-normal text-ink-2">
            {t('profile.identityCardTitle')}
          </p>
          <h2 className={cn('truncate font-semibold leading-tight text-ink', compact ? 'text-base' : 'text-2xl')}>
            {displayName}
          </h2>
          <p className="mt-1 truncate text-sm text-ink-2">@{identity.handle}</p>
        </div>
      </div>

      <dl className={cn('grid gap-3 text-sm', compact ? 'mt-4' : 'mt-5 sm:grid-cols-2')}>
        <div className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
          <div>
            <dt className="font-medium text-ink">{t('profile.joinedLabel')}</dt>
            <dd className="mt-0.5 text-ink-2">{joined}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Images className="mt-0.5 h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
          <div>
            <dt className="font-medium text-ink">{t('profile.publicWorksLabel')}</dt>
            <dd className="mt-0.5 text-ink-2">
              {t('profile.publicWorksSummary', { count: formatNumber(publicWorkCount) })}
            </dd>
          </div>
        </div>
      </dl>

      <div className={cn('flex items-start gap-2 text-sm text-ink-2', compact ? 'mt-4' : 'mt-5')}>
        <LinkIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>{t('profile.publicProfileSoon')}</p>
      </div>

      {action && <div className="mt-5">{action}</div>}
    </article>
  );
}

export function UserBadge({ identity, className, showPreview = true }: UserBadgeProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const previewId = useId();
  const displayName = getDisplayName(identity);

  const closeOnBlur = (event: FocusEvent<HTMLSpanElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsOpen(false);
    }
  };

  const closeOnEscape = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      event.currentTarget.blur();
    }
  };

  return (
    <span
      className={cn('relative inline-flex', className)}
      onBlur={closeOnBlur}
      onFocusCapture={() => setIsOpen(true)}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        className="inline-flex max-w-full items-center gap-2 rounded-full border border-ink/10 bg-surface px-2 py-1.5 text-left shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        aria-label={t('profile.identityPreviewLabel', { handle: identity.handle })}
        aria-expanded={showPreview ? isOpen : undefined}
        aria-describedby={showPreview ? previewId : undefined}
        onClick={() => setIsOpen(true)}
        onKeyDown={closeOnEscape}
      >
        <UserAvatar identity={identity} size="sm" />
        <span className="min-w-0">
          <span className="block max-w-44 truncate text-sm font-medium text-ink">{displayName}</span>
          <span className="block max-w-44 truncate text-xs text-ink-2">@{identity.handle}</span>
        </span>
      </button>

      {showPreview && (
        <span
          id={previewId}
          role="tooltip"
          className={cn(
            'absolute left-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-2rem)]',
            isOpen ? 'block' : 'hidden',
          )}
        >
          <UserProfileCard identity={identity} compact />
        </span>
      )}
    </span>
  );
}
