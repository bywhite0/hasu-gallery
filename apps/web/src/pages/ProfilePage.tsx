import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AlertTriangle, BookOpenText, CheckCircle, Clock, PenLine, Upload, XCircle } from 'lucide-react';
import type { WorkListItem, WorkStatus } from '@hasu-gallery/types';
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
  const [imageStatusFilter, setImageStatusFilter] = useState<StatusFilter>('all');
  const [fictionStatusFilter, setFictionStatusFilter] = useState<StatusFilter>('all');
  const [imagePage, setImagePage] = useState(1);
  const [fictionPage, setFictionPage] = useState(1);

  const { data: userInfo } = useQuery({
    queryKey: ['auth', 'me', user?.id],
    queryFn: () => Promise.resolve(user),
    enabled: !!user,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['user', user?.id, 'stats'],
    queryFn: getMyStats,
  });

  const { data: imageWorksData, isLoading: imageWorksLoading } = useQuery({
    queryKey: ['user', user?.id, 'works', 'image', imageStatusFilter, imagePage],
    queryFn: () =>
      getMyWorks({
        gallery: 'image',
        status: imageStatusFilter === 'all' ? undefined : imageStatusFilter,
        page: imagePage,
      }),
  });

  const { data: fictionWorksData, isLoading: fictionWorksLoading } = useQuery({
    queryKey: ['user', user?.id, 'works', 'fiction', fictionStatusFilter, fictionPage],
    queryFn: () =>
      getMyWorks({
        gallery: 'fiction',
        status: fictionStatusFilter === 'all' ? undefined : fictionStatusFilter,
        page: fictionPage,
      }),
  });

  const handleWorkClick = (work: WorkListItem) => {
    if (work.gallery === 'fiction') {
      if (work.status === 'approved') {
        navigate({ to: '/fiction/$id', params: { id: work.id } });
      } else {
        navigate({ to: '/profile/fictions' });
      }
      return;
    }
    navigate({ to: '/works/$id', params: { id: work.id } });
  };

  const handleUploadClick = () => {
    navigate({ to: '/upload' });
  };

  const handleFictionClick = () => {
    navigate({ to: '/profile/fictions' });
  };

  if (!userInfo) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-ink-2">{t('profile.loadingUser')}</p>
      </div>
    );
  }

  const imageTotal = Number(stats?.image_total ?? stats?.total ?? 0);
  const imagePending = Number(stats?.image_pending ?? stats?.pending ?? 0);
  const imageApproved = Number(stats?.image_approved ?? stats?.approved ?? 0);
  const imageRejected = Number(stats?.image_rejected ?? stats?.rejected ?? 0);
  const imageTakedown = Number(stats?.image_takedown ?? stats?.takedown ?? 0);
  const fictionTotal = Number(stats?.fiction_total ?? 0);
  const fictionPending = Number(stats?.fiction_pending ?? 0);
  const fictionApproved = Number(stats?.fiction_approved ?? 0);
  const fictionRejected = Number(stats?.fiction_rejected ?? 0);
  const fictionTakedown = Number(stats?.fiction_takedown ?? 0);
  const imageNeedsAttention = imageRejected + imageTakedown;
  const fictionNeedsAttention = fictionRejected + fictionTakedown;

  const identity: PublicUserIdentity = {
    displayName: userInfo.display_name,
    handle: userInfo.handle,
    joinedAt: userInfo.created_at,
    publicWorkCount: imageApproved + fictionApproved,
  };
  const displayName = identity.displayName?.trim() || identity.handle;
  const joined = identity.joinedAt
    ? t('profile.joined', { date: formatDate(identity.joinedAt) })
    : t('common.unknown');

  const imageFilterCounts: Record<StatusFilter, number> = {
    all: imageTotal,
    pending: imagePending,
    approved: imageApproved,
    rejected: imageRejected,
    takedown: imageTakedown,
  };
  const fictionFilterCounts: Record<StatusFilter, number> = {
    all: fictionTotal,
    pending: fictionPending,
    approved: fictionApproved,
    rejected: fictionRejected,
    takedown: fictionTakedown,
  };

  const workspaceMetrics = [
    {
      key: 'image-total',
      label: t('profile.imageUploads'),
      value: imageTotal,
      icon: Upload,
      className: 'text-ink',
    },
    {
      key: 'image-pending',
      label: t('profile.summaryWaiting'),
      value: imagePending,
      icon: Clock,
      className: 'text-warning',
    },
    {
      key: 'fiction-total',
      label: t('profile.fictionWorks'),
      value: fictionTotal,
      icon: BookOpenText,
      className: 'text-ink',
    },
    {
      key: 'attention',
      label: t('profile.summaryNeedsAttention'),
      value: imageNeedsAttention + fictionNeedsAttention,
      icon: AlertTriangle,
      className: 'text-danger',
    },
  ];

  const renderStatusFilters = (
    ariaLabel: string,
    current: StatusFilter,
    counts: Record<StatusFilter, number>,
    onChange: (status: StatusFilter) => void,
  ) => (
    <div
      className="flex gap-1 overflow-x-auto rounded-md border border-ink/10 bg-surface p-1"
      aria-label={ariaLabel}
    >
      {(Object.keys(filterKeys) as StatusFilter[]).map((status) => (
        <button
          key={status}
          type="button"
          className={cn(
            'inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
            current === status ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-accent hover:text-ink',
          )}
          onClick={() => onChange(status)}
          aria-pressed={current === status}
        >
          <span>{t(filterKeys[status])}</span>
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-xs',
              current === status ? 'bg-paper/20 text-paper' : 'bg-ink/5 text-ink-2',
            )}
          >
            {formatNumber(counts[status])}
          </span>
        </button>
      ))}
    </div>
  );

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

            <div className="flex w-full flex-col gap-2 sm:mt-4 sm:w-auto sm:flex-row">
              <Button type="button" variant="outline" onClick={handleFictionClick} className="w-full sm:w-auto">
                <PenLine className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('fictionWorkspace.open')}
              </Button>
              <Button type="button" onClick={handleUploadClick} className="w-full sm:w-auto">
                <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('profile.uploadImage')}
              </Button>
            </div>
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

      <section className="mt-8 space-y-4" aria-labelledby="profile-image-submissions">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="profile-image-submissions" className="text-2xl font-semibold text-ink">
              {t('profile.imageSectionTitle')}
            </h2>
            <span className="text-sm text-ink-2">
              {t('profile.imageSectionTotal', { count: formatNumber(imageTotal) })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-ink-2">
            <XCircle className="h-4 w-4" aria-hidden="true" />
            {t('profile.summaryRemoved', { count: formatNumber(imageTakedown) })}
          </div>
        </div>

        {renderStatusFilters(
          t('profile.imageSectionFilters'),
          imageStatusFilter,
          imageFilterCounts,
          (status) => {
            setImageStatusFilter(status);
            setImagePage(1);
          },
        )}

        {imageWorksLoading ? (
          <p className="rounded-md border border-ink/10 bg-surface py-8 text-center text-sm text-ink-2">
            {t('profile.loadingWorks')}
          </p>
        ) : imageWorksData?.works && imageWorksData.works.length > 0 ? (
          <>
            <MyWorksList works={imageWorksData.works} onWorkClick={handleWorkClick} />
            <Pagination
              currentPage={imagePage}
              totalPages={imageWorksData.pagination.total_pages}
              onPageChange={setImagePage}
            />
          </>
        ) : (
          <p className="rounded-md border border-dashed border-ink/20 bg-surface py-8 text-center text-sm text-ink-2">
            {t('profile.noImageWorksForFilter')}
          </p>
        )}
      </section>

      <section className="mt-10 space-y-4" aria-labelledby="profile-fiction-submissions">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="profile-fiction-submissions" className="text-2xl font-semibold text-ink">
              {t('profile.fictionSectionTitle')}
            </h2>
            <span className="text-sm text-ink-2">
              {t('profile.fictionSectionTotal', { count: formatNumber(fictionTotal) })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-ink-2">
            <span className="inline-flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" aria-hidden="true" />
              {t('profile.fictionPublishedCount', { count: formatNumber(fictionApproved) })}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={handleFictionClick}>
              <PenLine className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('fictionWorkspace.open')}
            </Button>
          </div>
        </div>

        {renderStatusFilters(
          t('profile.fictionSectionFilters'),
          fictionStatusFilter,
          fictionFilterCounts,
          (status) => {
            setFictionStatusFilter(status);
            setFictionPage(1);
          },
        )}

        {fictionWorksLoading ? (
          <p className="rounded-md border border-ink/10 bg-surface py-8 text-center text-sm text-ink-2">
            {t('profile.loadingWorks')}
          </p>
        ) : fictionWorksData?.works && fictionWorksData.works.length > 0 ? (
          <>
            <MyWorksList works={fictionWorksData.works} onWorkClick={handleWorkClick} />
            <Pagination
              currentPage={fictionPage}
              totalPages={fictionWorksData.pagination.total_pages}
              onPageChange={setFictionPage}
            />
          </>
        ) : (
          <div className="rounded-md border border-dashed border-ink/20 bg-surface px-4 py-8 text-center">
            <p className="text-sm text-ink-2">{t('profile.noFictionWorksForFilter')}</p>
            <div className="mt-4 flex justify-center">
              <Button type="button" variant="outline" onClick={handleFictionClick}>
                <PenLine className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('fictionWorkspace.open')}
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
