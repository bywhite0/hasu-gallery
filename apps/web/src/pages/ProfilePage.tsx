import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AlertTriangle, CheckCircle, Clock, Upload, XCircle } from 'lucide-react';
import type { WorkStatus } from '@hasu-gallery/types';
import { Button, cn } from '@hasu-gallery/ui';
import { useAuthStore } from '../store/auth';
import { getMyWorks, getMyStats } from '../api/profile';
import { MyWorksList } from '../components/MyWorksList';
import { Pagination } from '../components/Pagination';
import { UserAvatar, type PublicUserIdentity } from '../components/UserIdentity';
import { useI18n, type TranslationKey } from '../i18n';

type StatusFilter = 'all' | WorkStatus;

const filterKeys = {
  all: 'common.all',
  pending: 'status.waitingReview',
  approved: 'status.published',
  rejected: 'status.notAccepted',
  takedown: 'status.takedown',
} as const satisfies Record<StatusFilter, TranslationKey>;

export function ProfilePage() {
  const { t, formatDate, formatNumber } = useI18n();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);

  const { data: userInfo } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => Promise.resolve(user),
    enabled: !!user,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['user', 'stats'],
    queryFn: getMyStats,
  });

  const { data: worksData, isLoading: worksLoading } = useQuery({
    queryKey: ['user', 'works', statusFilter, page],
    queryFn: () => getMyWorks({ status: statusFilter === 'all' ? undefined : statusFilter, page }),
  });

  const handleStatusFilter = (status: StatusFilter) => {
    setStatusFilter(status);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleWorkClick = (id: string) => {
    navigate({ to: `/works/${id}` });
  };

  const handleUploadClick = () => {
    navigate({ to: '/upload' });
  };

  if (!userInfo) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-ink-2">{t('profile.loadingUser')}</p>
      </div>
    );
  }

  const total = Number(stats?.total ?? 0);
  const pending = Number(stats?.pending ?? 0);
  const approved = Number(stats?.approved ?? 0);
  const rejected = Number(stats?.rejected ?? 0);
  const takedown = Number(stats?.takedown ?? 0);
  const needsAttention = rejected + takedown;
  const identity: PublicUserIdentity = {
    displayName: userInfo.display_name,
    handle: userInfo.handle,
    joinedAt: userInfo.created_at,
    publicWorkCount: approved,
  };
  const displayName = identity.displayName?.trim() || identity.handle;
  const joined = identity.joinedAt
    ? t('profile.joined', { date: formatDate(identity.joinedAt) })
    : t('common.unknown');
  const filterCounts: Record<StatusFilter, number> = {
    all: total,
    pending,
    approved,
    rejected,
    takedown,
  };
  const workspaceMetrics = [
    {
      key: 'total',
      label: t('profile.totalUploads'),
      value: total,
      icon: Upload,
      className: 'text-ink',
    },
    {
      key: 'pending',
      label: t('profile.summaryWaiting'),
      value: pending,
      icon: Clock,
      className: 'text-warning',
    },
    {
      key: 'approved',
      label: t('profile.summaryPublished'),
      value: approved,
      icon: CheckCircle,
      className: 'text-success',
    },
    {
      key: 'attention',
      label: t('profile.summaryNeedsAttention'),
      value: needsAttention,
      icon: AlertTriangle,
      className: 'text-danger',
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:py-8">
      <section className="overflow-hidden rounded-md border border-ink/10 bg-surface shadow-sm">
        <div className="relative h-40 bg-[linear-gradient(135deg,rgba(252,232,230,0.98),rgba(239,239,232,0.94)_48%,rgba(83,131,195,0.18))] sm:h-52">
          <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,rgba(247,247,243,0),rgba(56,56,52,0.18))]" />
        </div>

        <div className="px-4 pb-4 sm:px-6 sm:pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
              <UserAvatar
                identity={identity}
                size="xl"
                className="relative z-10 -mt-8 border-4 border-surface shadow-sm sm:-mt-10"
              />
              <div className="min-w-0 pt-1 sm:pt-4">
                <p className="text-xs font-medium uppercase tracking-normal text-ink-2">
                  {t('profile.meTitle')}
                </p>
                <h1 className="truncate text-3xl font-semibold leading-tight text-ink sm:text-4xl">
                  {displayName}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
                  <span className="font-medium text-ink">@{identity.handle}</span>
                  <span>{joined}</span>
                </div>
              </div>
            </div>

            <Button type="button" onClick={handleUploadClick} className="w-full sm:mt-4 sm:w-auto">
              <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('home.uploadWork')}
            </Button>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-ink/10 bg-ink/10 md:grid-cols-4">
            {workspaceMetrics.map((metric) => {
              const Icon = metric.icon;

              return (
                <div key={metric.key} className="bg-paper px-3 py-3 sm:px-4">
                  <dt className="flex min-w-0 items-start gap-2 text-xs font-medium leading-tight text-ink-2">
                    <Icon className={cn('h-4 w-4 shrink-0', metric.className)} aria-hidden="true" />
                    <span>{metric.label}</span>
                  </dt>
                  <dd className={cn('mt-2 text-2xl font-semibold leading-none', metric.className)}>
                    {statsLoading ? '0' : formatNumber(metric.value)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </section>

      <section className="mt-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-2xl font-semibold text-ink">{t('profile.submissionWorkspace')}</h2>
            <span className="text-sm text-ink-2">
              {t('profile.submissionTotal', { count: formatNumber(total) })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-ink-2">
            <XCircle className="h-4 w-4" aria-hidden="true" />
            {t('profile.summaryRemoved', { count: formatNumber(takedown) })}
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-md border border-ink/10 bg-surface p-1" aria-label={t('filter.status')}>
          {(Object.keys(filterKeys) as StatusFilter[]).map((status) => (
            <button
              key={status}
              type="button"
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
                statusFilter === status
                  ? 'bg-ink text-paper'
                  : 'text-ink-2 hover:bg-accent hover:text-ink',
              )}
              onClick={() => handleStatusFilter(status)}
              aria-pressed={statusFilter === status}
            >
              <span>{t(filterKeys[status])}</span>
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-xs',
                statusFilter === status ? 'bg-paper/20 text-paper' : 'bg-ink/5 text-ink-2',
              )}>
                {formatNumber(filterCounts[status])}
              </span>
            </button>
          ))}
        </div>

        {worksLoading ? (
          <p className="rounded-md border border-ink/10 bg-surface py-8 text-center text-sm text-ink-2">
            {t('profile.loadingWorks')}
          </p>
        ) : worksData?.works && worksData.works.length > 0 ? (
          <>
            <MyWorksList works={worksData.works} onWorkClick={handleWorkClick} />
            <Pagination
              currentPage={page}
              totalPages={worksData.pagination.total_pages}
              onPageChange={handlePageChange}
            />
          </>
        ) : (
          <p className="rounded-md border border-dashed border-ink/20 bg-surface py-8 text-center text-sm text-ink-2">
            {t('profile.noWorksForFilter')}
          </p>
        )}
      </section>
    </div>
  );
}
