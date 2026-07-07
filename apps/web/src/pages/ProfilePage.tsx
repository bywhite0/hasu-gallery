import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AlertTriangle, CheckCircle, Clock, Upload, XCircle } from 'lucide-react';
import type { WorkStatus } from '@hasu-gallery/types';
import { Button } from '@hasu-gallery/ui';
import { useAuthStore } from '../store/auth';
import { getMyWorks, getMyStats } from '../api/profile';
import { MyWorksList } from '../components/MyWorksList';
import { Pagination } from '../components/Pagination';
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

  const joinDate = userInfo.created_at
    ? formatDate(userInfo.created_at)
    : t('common.unknown');
  const total = Number(stats?.total ?? 0);
  const pending = Number(stats?.pending ?? 0);
  const approved = Number(stats?.approved ?? 0);
  const rejected = Number(stats?.rejected ?? 0);
  const takedown = Number(stats?.takedown ?? 0);
  const needsAttention = rejected + takedown;
  const filterCounts: Record<StatusFilter, number> = {
    all: total,
    pending,
    approved,
    rejected,
    takedown,
  };
  const workspaceMetrics = [
    {
      key: 'pending',
      label: t('profile.summaryWaiting'),
      description: t('profile.summaryWaitingDescription'),
      value: pending,
      icon: Clock,
      className: 'text-warning',
    },
    {
      key: 'approved',
      label: t('profile.summaryPublished'),
      description: t('profile.summaryPublishedDescription'),
      value: approved,
      icon: CheckCircle,
      className: 'text-success',
    },
    {
      key: 'attention',
      label: t('profile.summaryNeedsAttention'),
      description: t('profile.summaryNeedsAttentionDescription'),
      value: needsAttention,
      icon: AlertTriangle,
      className: 'text-danger',
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:py-8">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <p className="text-sm font-medium text-ink-2">{t('profile.workspaceTitle')}</p>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold leading-tight text-ink sm:text-4xl">
              {userInfo.display_name || userInfo.handle}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-ink-2 sm:text-base">
              {t('profile.workspaceDescription')}
            </p>
          </div>
          <Button type="button" onClick={handleUploadClick}>
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('home.uploadWork')}
          </Button>
        </div>

        <aside className="rounded-md border border-ink/10 bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">{t('profile.accountDetails')}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-ink-2">{t('auth.handle')}</dt>
              <dd className="font-medium text-ink">@{userInfo.handle}</dd>
            </div>
            {userInfo.email && (
              <div>
                <dt className="text-ink-2">{t('auth.email')}</dt>
                <dd className="break-all font-medium text-ink">{userInfo.email}</dd>
              </div>
            )}
            <div>
              <dt className="text-ink-2">{t('profile.joinedLabel')}</dt>
              <dd className="font-medium text-ink">{joinDate}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {workspaceMetrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <article key={metric.key} className="rounded-md border border-ink/10 bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-ink">{metric.label}</h2>
                  <p className="mt-1 text-sm leading-5 text-ink-2">{metric.description}</p>
                </div>
                <Icon className={`h-5 w-5 shrink-0 ${metric.className}`} aria-hidden="true" />
              </div>
              <p className={`mt-4 text-3xl font-semibold ${metric.className}`}>
                {statsLoading ? '0' : formatNumber(metric.value)}
              </p>
            </article>
          );
        })}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-ink">{t('profile.submissionWorkspace')}</h2>
            <p className="mt-1 text-sm text-ink-2">
              {t('profile.submissionWorkspaceDescription', { count: formatNumber(total) })}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-ink-2">
            <XCircle className="h-4 w-4" aria-hidden="true" />
            {t('profile.summaryRemoved', { count: formatNumber(takedown) })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2" aria-label={t('filter.status')}>
          {(Object.keys(filterKeys) as StatusFilter[]).map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              onClick={() => handleStatusFilter(status)}
              size="sm"
            >
              {t(filterKeys[status])} ({formatNumber(filterCounts[status])})
            </Button>
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
