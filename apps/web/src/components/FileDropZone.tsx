import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

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
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('File size must be less than 10MB');
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

  const handleClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        bg-surface border-2 rounded-lg p-8 text-center cursor-pointer
        transition-all duration-200
        ${isDragging ? 'border-solid border-primary bg-primary/5' : 'border-dashed border-border'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-solid hover:border-primary'}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        disabled={disabled}
        className="hidden"
      />

      <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />

      <p className="text-base text-foreground mb-2">
        Drag & drop an image here, or click to select
      </p>

      <p className="text-sm text-muted-foreground">
        Maximum file size: 10MB
      </p>

      {error && (
        <p className="text-sm text-destructive mt-4">
          {error}
        </p>
      )}
    </div>
  );
}
