import { WorkListItem } from '@hasu-gallery/types';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

interface MyWorksListProps {
  works: WorkListItem[];
  onWorkClick: (id: string) => void;
}

const statusConfig = {
  pending: {
    icon: Clock,
    label: 'Pending',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  approved: {
    icon: CheckCircle,
    label: 'Approved',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  rejected: {
    icon: XCircle,
    label: 'Rejected',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  takedown: {
    icon: XCircle,
    label: 'Takedown',
    className: 'bg-gray-100 text-gray-800 border-gray-200',
  },
};

export function MyWorksList({ works, onWorkClick }: MyWorksListProps) {
  if (works.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">No works found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      {works.map((work) => {
        const config = statusConfig[work.status];
        const Icon = config.icon;
        const createdDate = new Date(work.created_at).toLocaleDateString();

        return (
          <div
            key={work.id}
            className="bg-surface rounded-md overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onWorkClick(work.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onWorkClick(work.id);
              }
            }}
          >
            <div className="relative">
              <div
                className="aspect-square bg-cover bg-center"
                style={{ backgroundImage: `url(${work.thumbnail_url})` }}
              />
              <div className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${config.className}`}>
                <Icon className="w-3 h-3" />
                <span>{config.label}</span>
              </div>
            </div>
            <div className="p-3">
              <h3 className="font-medium text-sm truncate mb-1">{work.title}</h3>
              <p className="text-xs text-muted-foreground">{createdDate}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
