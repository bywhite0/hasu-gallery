import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@hasu-gallery/ui';
import { useI18n } from '../i18n';

interface ImagePreviewProps {
  file: File;
  onRemove: () => void;
}

interface ImageDimensions {
  width: number;
  height: number;
}

export function ImagePreview({ file, onRemove }: ImagePreviewProps) {
  const { t, formatFileSize } = useI18n();
  const [objectUrl, setObjectUrl] = useState<string>('');
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);

    const img = new Image();
    img.onload = () => {
      setDimensions({ width: img.width, height: img.height });
    };
    img.src = url;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <div className="relative rounded-lg overflow-hidden border border-border bg-card">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 h-8 w-8 z-10"
        onClick={onRemove}
        aria-label={t('preview.remove')}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>

      <div className="flex justify-center items-center p-4 bg-muted/30">
        {objectUrl && (
          <img
            src={objectUrl}
            alt={t('preview.alt', { name: file.name })}
            className="max-h-64 w-auto object-contain"
          />
        )}
      </div>

      <div className="p-3 space-y-1 text-sm border-t border-border">
        <div className="font-medium truncate" title={file.name}>
          {file.name}
        </div>
        <div className="text-muted-foreground">
          {formatFileSize(file.size)}
          {dimensions && (
            <span className="ml-2">
              {dimensions.width} × {dimensions.height} px
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
