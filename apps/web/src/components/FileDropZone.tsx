import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Upload } from 'lucide-react';
import { useI18n } from '../i18n';

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  accept?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function FileDropZone({
  onFileSelect,
  disabled = false,
  accept = 'image/*',
}: FileDropZoneProps) {
  const { t } = useI18n();
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    if (!file.type.startsWith('image/')) {
      setError(t('dropzone.invalidType'));
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(t('dropzone.invalidSize'));
      return false;
    }

    setError(null);
    return true;
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  };

  const openFilePicker = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLLabelElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openFilePicker();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        onFileSelect(file);
        e.target.value = '';
      }
    }
  };

  return (
    <div>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        disabled={disabled}
        aria-label={t('dropzone.chooseAria')}
        aria-invalid={Boolean(error)}
        aria-describedby={`${hintId}${error ? ` ${errorId}` : ''}`}
        tabIndex={-1}
        className="sr-only"
      />

      <label
        htmlFor={inputId}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-describedby={`${hintId}${error ? ` ${errorId}` : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={handleKeyDown}
        className={`
          bg-surface border-2 rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200 block
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
          ${isDragging ? 'border-solid border-primary bg-primary/5' : 'border-dashed border-border'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-solid hover:border-primary'}
        `}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />

        <p className="text-base text-foreground mb-2">
          {t('dropzone.prompt')}
        </p>

        <p id={hintId} className="text-sm text-muted-foreground">
          {t('dropzone.hint')}
        </p>

        {error && (
          <p id={errorId} role="alert" aria-live="assertive" className="text-sm text-destructive mt-4">
            {error}
          </p>
        )}
      </label>
    </div>
  );
}
