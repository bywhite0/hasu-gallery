import { Button } from '@hasu-gallery/ui';
import { useI18n } from '../i18n';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const { t } = useI18n();

  return (
    <div className="flex justify-center items-center gap-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        {t('common.prev')}
      </Button>

      <span className="text-sm text-ink-2">
        {t('common.pageOf', { current: currentPage, total: totalPages })}
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
      >
        {t('common.next')}
      </Button>
    </div>
  );
}
