import { useState, FormEvent } from 'react';
import { Button } from '@hasu-gallery/ui';

interface UploadFormProps {
  file: File;
  onSubmit: (data: FormData) => Promise<void>;
  isUploading: boolean;
}

export function UploadForm({ file, onSubmit, isUploading }: UploadFormProps) {
  const [title, setTitle] = useState('');
  const [gallery, setGallery] = useState('');
  const [origin, setOrigin] = useState('');
  const [source, setSource] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    } else if (title.length < 1 || title.length > 200) {
      newErrors.title = 'Title must be between 1 and 200 characters';
    }

    if (!gallery) {
      newErrors.gallery = 'Gallery type is required';
    }

    if (gallery === 'meme' && !origin) {
      newErrors.origin = 'Origin is required for meme gallery';
    }

    if (sourceUrl && sourceUrl.trim()) {
      try {
        new URL(sourceUrl);
      } catch {
        newErrors.sourceUrl = 'Invalid URL format';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title.trim());
    formData.append('gallery', gallery);
    if (gallery === 'meme') {
      formData.append('origin', origin);
    }
    if (source.trim()) {
      formData.append('source', source.trim());
    }
    if (sourceUrl.trim()) {
      formData.append('source_url', sourceUrl.trim());
    }

    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">
          Title *
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isUploading}
          className="w-full px-3 py-2 border rounded-md disabled:opacity-50"
          maxLength={200}
        />
        {errors.title && (
          <p className="text-sm text-red-600 mt-1">{errors.title}</p>
        )}
      </div>

      <div>
        <label htmlFor="gallery" className="block text-sm font-medium mb-1">
          Gallery *
        </label>
        <select
          id="gallery"
          value={gallery}
          onChange={(e) => setGallery(e.target.value)}
          disabled={isUploading}
          className="w-full px-3 py-2 border rounded-md disabled:opacity-50"
        >
          <option value="">Select gallery type</option>
          <option value="meme">Meme</option>
          <option value="art">Art</option>
        </select>
        {errors.gallery && (
          <p className="text-sm text-red-600 mt-1">{errors.gallery}</p>
        )}
      </div>

      {gallery === 'meme' && (
        <div>
          <label htmlFor="origin" className="block text-sm font-medium mb-1">
            Origin *
          </label>
          <select
            id="origin"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            disabled={isUploading}
            className="w-full px-3 py-2 border rounded-md disabled:opacity-50"
          >
            <option value="">Select origin</option>
            <option value="official">Official</option>
            <option value="derived">Derived</option>
            <option value="fan_made">Fan Made</option>
          </select>
          {errors.origin && (
            <p className="text-sm text-red-600 mt-1">{errors.origin}</p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="source" className="block text-sm font-medium mb-1">
          Source
        </label>
        <textarea
          id="source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          disabled={isUploading}
          className="w-full px-3 py-2 border rounded-md disabled:opacity-50"
          rows={3}
          placeholder="Optional source information"
        />
      </div>

      <div>
        <label htmlFor="sourceUrl" className="block text-sm font-medium mb-1">
          Source URL
        </label>
        <input
          type="url"
          id="sourceUrl"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          disabled={isUploading}
          className="w-full px-3 py-2 border rounded-md disabled:opacity-50"
          placeholder="https://example.com"
        />
        {errors.sourceUrl && (
          <p className="text-sm text-red-600 mt-1">{errors.sourceUrl}</p>
        )}
      </div>

      <Button type="submit" disabled={isUploading} className="w-full">
        {isUploading ? 'Uploading...' : 'Upload'}
      </Button>
    </form>
  );
}
