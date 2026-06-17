import type { WorkListItem } from '@hasu-gallery/types';
import { WorkCard } from './WorkCard';

interface WorksGridProps {
  works: WorkListItem[];
  onWorkClick?: (workId: string) => void;
}

export function WorksGrid({ works, onWorkClick }: WorksGridProps) {
  if (works.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">No works found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      {works.map((work) => (
        <WorkCard
          key={work.id}
          work={work}
          onClick={() => onWorkClick?.(work.id)}
        />
      ))}
    </div>
  );
}
