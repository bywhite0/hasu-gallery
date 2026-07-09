export const SUPPORTED_LOCALES = ['en', 'zh-Hans', 'zh-Hant', 'ja'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const localeOptions: Array<{ locale: Locale; label: string; nativeLabel: string }> = [
  { locale: 'en', label: 'English', nativeLabel: 'English' },
  { locale: 'zh-Hans', label: 'Simplified Chinese', nativeLabel: '简体中文' },
  { locale: 'zh-Hant', label: 'Traditional Chinese', nativeLabel: '繁體中文' },
  { locale: 'ja', label: 'Japanese', nativeLabel: '日本語' },
];

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && SUPPORTED_LOCALES.includes(value as Locale);
}

export function toIntlLocale(locale: Locale) {
  return locale;
}
