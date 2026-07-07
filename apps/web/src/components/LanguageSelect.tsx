import { Languages } from 'lucide-react';
import { useI18n, type Locale } from '../i18n';

export function LanguageSelect() {
  const { locale, localeOptions, setLocale, t } = useI18n();

  return (
    <label className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-ink/20 bg-paper px-2 text-sm text-ink">
      <Languages className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">{t('language.label')}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        aria-label={t('language.label')}
        className="h-6 max-w-[7.5rem] bg-transparent text-sm outline-none"
      >
        {localeOptions.map((option) => (
          <option key={option.locale} value={option.locale}>
            {option.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
