import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Clock, CheckCircle, XCircle, Upload } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { getMyWorks, getMyStats } from '../api/profile';
import { StatsCard } from '../components/StatsCard';
import { MyWorksList } from '../components/MyWorksList';
import { Pagination } from '../components/Pagination';
import { Button } from '@hasu-gallery/ui';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);

  // User info query
  const { data: userInfo } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => Promise.resolve(user),
    enabled: !!user,
  });

  // Stats query
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['user', 'stats'],
    queryFn: getMyStats,
  });

  // Works query
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

  if (!userInfo) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-muted-foreground">Loading user information...</p>
      </div>
    );
  }

  const joinDate = userInfo.created_at
    ? new Date(userInfo.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown';

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* User info header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">{userInfo.display_name || userInfo.handle}</h1>
        <p className="text-lg text-muted-foreground">@{userInfo.handle}</p>
        {userInfo.email && <p className="text-sm text-muted-foreground">{userInfo.email}</p>}
        <p className="text-sm text-muted-foreground">Joined {joinDate}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Total Uploads"
          value={statsLoading ? 0 : Number(stats?.total ?? 0)}
          icon={<Upload className="h-5 w-5" />}
          variant="default"
        />
        <StatsCard
          label="Pending"
          value={statsLoading ? 0 : Number(stats?.pending ?? 0)}
          icon={<Clock className="h-5 w-5" />}
          variant="warning"
        />
        <StatsCard
          label="Approved"
          value={statsLoading ? 0 : Number(stats?.approved ?? 0)}
          icon={<CheckCircle className="h-5 w-5" />}
          variant="success"
        />
        <StatsCard
          label="Rejected"
          value={statsLoading ? 0 : Number(stats?.rejected ?? 0)}
          icon={<XCircle className="h-5 w-5" />}
          variant="danger"
        />
      </div>

      {/* My uploads section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">My Uploads</h2>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            onClick={() => handleStatusFilter('all')}
          >
            All
          </Button>
          <Button
            variant={statusFilter === 'pending' ? 'default' : 'outline'}
            onClick={() => handleStatusFilter('pending')}
          >
            Pending
          </Button>
          <Button
            variant={statusFilter === 'approved' ? 'default' : 'outline'}
            onClick={() => handleStatusFilter('approved')}
          >
            Approved
          </Button>
          <Button
            variant={statusFilter === 'rejected' ? 'default' : 'outline'}
            onClick={() => handleStatusFilter('rejected')}
          >
            Rejected
          </Button>
        </div>

        {/* Works list */}
        {worksLoading ? (
          <p className="text-center text-muted-foreground py-8">Loading works...</p>
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
          <p className="text-center text-muted-foreground py-8">
            No works found for the selected filter.
          </p>
        )}
      </div>
    </div>
  );
}
