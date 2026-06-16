import { WorkListItem } from '@hasu-gallery/types';

interface WorkCardProps {
  work: WorkListItem;
  onClick?: () => void;
}

export function WorkCard({ work, onClick }: WorkCardProps) {
  return (
    <div
      className="bg-surface rounded-md overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div
        className="aspect-square bg-cover bg-center relative group"
        style={{ backgroundImage: `url(${work.thumbnail_url})` }}
      >
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
          <h3 className="text-white font-medium text-lg mb-1">{work.title}</h3>
          <p className="text-white/80 text-sm">
            {work.width} × {work.height}
          </p>
        </div>
      </div>
    </div>
  );
}
