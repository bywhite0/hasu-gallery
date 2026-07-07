import { useMemo } from 'react';
import { useAppStore } from '../store';
import { DEFAULT_LOCALE, localeOptions, toIntlLocale, type Locale } from './locales';
import { messages, type TranslationKey } from './translations';

type TranslationParams = Record<string, string | number>;

const statusKeys = {
  pending: 'status.pending',
  approved: 'status.approved',
  rejected: 'status.rejected',
  takedown: 'status.takedown',
} as const satisfies Record<string, TranslationKey>;

const publicStatusKeys = {
  pending: 'status.waitingReview',
  approved: 'status.published',
  rejected: 'status.notAccepted',
  takedown: 'status.takedown',
} as const satisfies Record<string, TranslationKey>;

const originKeys = {
  official: 'origin.official',
  derived: 'origin.derived',
  fan_made: 'origin.fanMade',
} as const satisfies Record<string, TranslationKey>;

const ratingKeys = {
  all_ages: 'rating.allAges',
  r15: 'rating.r15',
  r18: 'rating.r18',
} as const satisfies Record<string, TranslationKey>;

const galleryKeys = {
  meme: 'gallery.meme',
  art: 'gallery.art',
} as const satisfies Record<string, TranslationKey>;

const shortGalleryKeys = {
  meme: 'gallery.memeShort',
  art: 'gallery.artShort',
} as const satisfies Record<string, TranslationKey>;

function interpolate(template: string, params?: TranslationParams) {
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

export function translate(locale: Locale, key: TranslationKey, params?: TranslationParams) {
  return interpolate(messages[locale]?.[key] ?? messages[DEFAULT_LOCALE][key], params);
}

export function useI18n() {
  const locale = useAppStore((state) => state.locale);
  const setLocale = useAppStore((state) => state.setLocale);

  return useMemo(() => {
    const intlLocale = toIntlLocale(locale);
    const t = (key: TranslationKey, params?: TranslationParams) => translate(locale, key, params);
    const numberFormatter = new Intl.NumberFormat(intlLocale);
    const compactNumberFormatter = new Intl.NumberFormat(intlLocale, {
      maximumFractionDigits: 1,
    });

    return {
      locale,
      localeOptions,
      setLocale,
      t,
      galleryLabel: (gallery: string) =>
        gallery in galleryKeys ? t(galleryKeys[gallery as keyof typeof galleryKeys]) : gallery,
      galleryShortLabel: (gallery: string) =>
        gallery in shortGalleryKeys ? t(shortGalleryKeys[gallery as keyof typeof shortGalleryKeys]) : gallery,
      statusLabel: (status: string) =>
        status in statusKeys ? t(statusKeys[status as keyof typeof statusKeys]) : status,
      publicStatusLabel: (status: string) =>
        status in publicStatusKeys
          ? t(publicStatusKeys[status as keyof typeof publicStatusKeys])
          : status,
      originLabel: (origin: string) =>
        origin in originKeys ? t(originKeys[origin as keyof typeof originKeys]) : origin,
      ratingLabel: (rating: string) =>
        rating in ratingKeys ? t(ratingKeys[rating as keyof typeof ratingKeys]) : rating,
      formatDate: (value: string | number | Date) =>
        new Intl.DateTimeFormat(intlLocale, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(new Date(value)),
      formatDateTime: (value: string | number | Date) =>
        new Intl.DateTimeFormat(intlLocale, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(value)),
      formatNumber: (value: number) => numberFormatter.format(value),
      formatFileSize: (bytes: number) => {
        if (bytes < 1024) return `${numberFormatter.format(bytes)} B`;
        if (bytes < 1024 * 1024) return `${compactNumberFormatter.format(bytes / 1024)} KB`;
        return `${compactNumberFormatter.format(bytes / (1024 * 1024))} MB`;
      },
    };
  }, [locale, setLocale]);
}

export type { Locale, TranslationKey };
export { DEFAULT_LOCALE, localeOptions, isSupportedLocale } from './locales';
