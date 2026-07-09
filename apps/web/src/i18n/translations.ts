import type { Locale } from './config';
import enMessages from './locales/en.json';
import jaMessages from './locales/ja.json';
import zhHansMessages from './locales/zh-Hans.json';
import zhHantMessages from './locales/zh-Hant.json';

export type TranslationKey = keyof typeof enMessages;
type Messages = Record<TranslationKey, string>;

export const messages = {
  en: enMessages,
  'zh-Hans': zhHansMessages,
  'zh-Hant': zhHantMessages,
  ja: jaMessages,
} satisfies Record<Locale, Messages>;
