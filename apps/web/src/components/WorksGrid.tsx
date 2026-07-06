import type { WorkListItem } from '@hasu-gallery/types';
import { WorkCard } from './WorkCard';

interface WorksGridProps {
  works: WorkListItem[];
}

export function WorksGrid({ works }: WorksGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {works.map((work) => (
        <WorkCard key={work.id} work={work} />
      ))}
    </div>
  );
}
