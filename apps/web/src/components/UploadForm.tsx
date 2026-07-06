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
  const [artist, setArtist] = useState('');
  const [medium, setMedium] = useState('');
  const [rating, setRating] = useState('all_ages');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const errorMessages = Object.values(errors);

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

    if (gallery === 'meme' && (origin === 'derived' || origin === 'fan_made') && !source.trim()) {
      newErrors.source = 'Source is required for derived or fan-made memes';
    }

    if (gallery === 'art') {
      if (!artist.trim()) {
        newErrors.artist = 'Artist is required for art gallery';
      }
      if (!rating) {
        newErrors.rating = 'Rating is required for art gallery';
      }
      if (!sourceUrl.trim()) {
        newErrors.sourceUrl = 'Source URL is required for art gallery';
      }
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
    if (gallery === 'art') {
      formData.append('artist', artist.trim());
      if (medium.trim()) {
        formData.append('medium', medium.trim());
      }
      formData.append('rating', rating);
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
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {errorMessages.length > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          Please fix {errorMessages.length} upload detail{errorMessages.length === 1 ? '' : 's'} before submitting.
        </div>
      )}

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
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'title-error' : undefined}
        />
        {errors.title && (
          <p id="title-error" className="text-sm text-red-600 mt-1">{errors.title}</p>
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
          aria-invalid={Boolean(errors.gallery)}
          aria-describedby={errors.gallery ? 'gallery-error' : undefined}
        >
          <option value="">Select gallery type</option>
          <option value="meme">Meme</option>
          <option value="art">Art</option>
        </select>
        {errors.gallery && (
          <p id="gallery-error" className="text-sm text-red-600 mt-1">{errors.gallery}</p>
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
            aria-invalid={Boolean(errors.origin)}
            aria-describedby={errors.origin ? 'origin-error' : undefined}
          >
            <option value="">Select origin</option>
            <option value="official">Official</option>
            <option value="derived">Derived</option>
            <option value="fan_made">Fan Made</option>
          </select>
          {errors.origin && (
            <p id="origin-error" className="text-sm text-red-600 mt-1">{errors.origin}</p>
          )}
        </div>
      )}

      {gallery === 'art' && (
        <>
          <div>
            <label htmlFor="artist" className="block text-sm font-medium mb-1">
              Artist *
            </label>
            <input
              type="text"
              id="artist"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              disabled={isUploading}
              className="w-full px-3 py-2 border rounded-md disabled:opacity-50"
              maxLength={200}
              placeholder="Artist name"
              aria-invalid={Boolean(errors.artist)}
              aria-describedby={errors.artist ? 'artist-error' : undefined}
            />
            {errors.artist && (
              <p id="artist-error" className="text-sm text-red-600 mt-1">{errors.artist}</p>
            )}
          </div>

          <div>
            <label htmlFor="medium" className="block text-sm font-medium mb-1">
              Medium
            </label>
            <input
              type="text"
              id="medium"
              value={medium}
              onChange={(e) => setMedium(e.target.value)}
              disabled={isUploading}
              className="w-full px-3 py-2 border rounded-md disabled:opacity-50"
              maxLength={100}
              placeholder="e.g. Digital, Watercolor, Pencil"
            />
          </div>

          <div>
            <label htmlFor="rating" className="block text-sm font-medium mb-1">
              Rating *
            </label>
            <select
              id="rating"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              disabled={isUploading}
              className="w-full px-3 py-2 border rounded-md disabled:opacity-50"
              aria-invalid={Boolean(errors.rating)}
              aria-describedby={errors.rating ? 'rating-error' : undefined}
            >
              <option value="all_ages">All Ages</option>
              <option value="r15">R-15</option>
              <option value="r18">R-18</option>
            </select>
            {errors.rating && (
              <p id="rating-error" className="text-sm text-red-600 mt-1">{errors.rating}</p>
            )}
          </div>
        </>
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
          aria-invalid={Boolean(errors.sourceUrl)}
          aria-describedby={errors.sourceUrl ? 'source-url-error' : undefined}
        />
        {errors.sourceUrl && (
          <p id="source-url-error" className="text-sm text-red-600 mt-1">{errors.sourceUrl}</p>
        )}
      </div>

      <Button type="submit" disabled={isUploading} className="w-full">
        {isUploading ? 'Submitting...' : 'Submit for review'}
      </Button>
    </form>
  );
}
