import { useState, FormEvent } from 'react';
import { Button, Field, FormMessage, Input, Select, Textarea } from '@hasu-gallery/ui';
import { useI18n } from '../i18n';

interface UploadFormProps {
  file: File;
  onSubmit: (data: FormData) => Promise<void>;
  isUploading: boolean;
}

export function UploadForm({ file, onSubmit, isUploading }: UploadFormProps) {
  const { t, originLabel, ratingLabel } = useI18n();
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
      newErrors.title = t('upload.validationTitleRequired');
    } else if (title.length < 1 || title.length > 200) {
      newErrors.title = t('upload.validationTitleLength');
    }

    if (!gallery) {
      newErrors.gallery = t('upload.validationGalleryRequired');
    }

    if (gallery === 'meme' && !origin) {
      newErrors.origin = t('upload.validationOriginRequired');
    }

    if (gallery === 'meme' && (origin === 'derived' || origin === 'fan_made') && !source.trim()) {
      newErrors.source = t('upload.validationSourceRequired');
    }

    if (gallery === 'art') {
      if (!artist.trim()) {
        newErrors.artist = t('upload.validationArtistRequired');
      }
      if (!rating) {
        newErrors.rating = t('upload.validationRatingRequired');
      }
      if (!sourceUrl.trim()) {
        newErrors.sourceUrl = t('upload.validationSourceUrlRequired');
      }
    }

    if (sourceUrl && sourceUrl.trim()) {
      try {
        new URL(sourceUrl);
      } catch {
        newErrors.sourceUrl = t('upload.validationUrl');
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
        <FormMessage aria-live="assertive">
          {t('upload.fixDetails', {
            count: errorMessages.length,
            plural: errorMessages.length === 1 ? '' : 's',
          })}
        </FormMessage>
      )}

      <Field label={t('upload.fieldTitle')} htmlFor="title" required error={errors.title}>
        <Input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isUploading}
          maxLength={200}
          invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'title-error' : undefined}
        />
      </Field>

      <Field label={t('upload.fieldGallery')} htmlFor="gallery" required error={errors.gallery}>
        <Select
          id="gallery"
          value={gallery}
          onChange={(e) => setGallery(e.target.value)}
          disabled={isUploading}
          invalid={Boolean(errors.gallery)}
          aria-describedby={errors.gallery ? 'gallery-error' : undefined}
        >
          <option value="">{t('upload.selectGallery')}</option>
          <option value="meme">{t('gallery.memeShort')}</option>
          <option value="art">{t('gallery.artShort')}</option>
        </Select>
      </Field>

      {gallery === 'meme' && (
        <Field label={t('upload.fieldOrigin')} htmlFor="origin" required error={errors.origin}>
          <Select
            id="origin"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            disabled={isUploading}
            invalid={Boolean(errors.origin)}
            aria-describedby={errors.origin ? 'origin-error' : undefined}
          >
            <option value="">{t('upload.selectOrigin')}</option>
            <option value="official">{originLabel('official')}</option>
            <option value="derived">{originLabel('derived')}</option>
            <option value="fan_made">{originLabel('fan_made')}</option>
          </Select>
        </Field>
      )}

      {gallery === 'art' && (
        <>
          <Field label={t('upload.fieldArtist')} htmlFor="artist" required error={errors.artist}>
            <Input
              type="text"
              id="artist"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              disabled={isUploading}
              maxLength={200}
              placeholder={t('upload.artistPlaceholder')}
              invalid={Boolean(errors.artist)}
              aria-describedby={errors.artist ? 'artist-error' : undefined}
            />
          </Field>

          <Field label={t('upload.fieldMedium')} htmlFor="medium">
            <Input
              type="text"
              id="medium"
              value={medium}
              onChange={(e) => setMedium(e.target.value)}
              disabled={isUploading}
              maxLength={100}
              placeholder={t('upload.mediumPlaceholder')}
            />
          </Field>

          <Field label={t('upload.fieldRating')} htmlFor="rating" required error={errors.rating}>
            <Select
              id="rating"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              disabled={isUploading}
              invalid={Boolean(errors.rating)}
              aria-describedby={errors.rating ? 'rating-error' : undefined}
            >
              <option value="all_ages">{ratingLabel('all_ages')}</option>
              <option value="r15">{ratingLabel('r15')}</option>
              <option value="r18">{ratingLabel('r18')}</option>
            </Select>
          </Field>
        </>
      )}

      <Field label={t('upload.fieldSource')} htmlFor="source" error={errors.source}>
        <Textarea
          id="source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          disabled={isUploading}
          rows={3}
          placeholder={t('upload.sourcePlaceholder')}
          invalid={Boolean(errors.source)}
          aria-describedby={errors.source ? 'source-error' : undefined}
        />
      </Field>

      <Field label={t('upload.fieldSourceUrl')} htmlFor="sourceUrl" error={errors.sourceUrl}>
        <Input
          type="url"
          id="sourceUrl"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          disabled={isUploading}
          placeholder="https://example.com"
          invalid={Boolean(errors.sourceUrl)}
          aria-describedby={errors.sourceUrl ? 'sourceUrl-error' : undefined}
        />
      </Field>

      <Button type="submit" disabled={isUploading} className="w-full">
        {isUploading ? t('upload.submitting') : t('upload.submit')}
      </Button>
    </form>
  );
}
