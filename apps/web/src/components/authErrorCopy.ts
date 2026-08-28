import type { TranslationKey } from '../i18n';
import { isNetworkError } from '../lib/network';

type AuthIntent = "login" | "register";
type Translate = (key: TranslationKey) => string;

export function getAuthErrorMessage(
  error: string | null,
  intent: AuthIntent,
  t: Translate,
): string | null {
  if (!error) return null;

  if (isNetworkError(error)) {
    return t('auth.errorNetwork');
  }

  if (intent === "login" && /http 401|http 403|invalid/i.test(error)) {
    return t('auth.errorInvalidLogin');
  }

  if (intent === "register" && /http 409|already exists|duplicate/i.test(error)) {
    return t('auth.errorDuplicateRegister');
  }

  if (/http 5\d\d/i.test(error)) {
    return t('auth.errorServer');
  }

  return intent === "login" ? t('auth.errorLoginFallback') : t('auth.errorRegisterFallback');
}

export function isRecoverableAuthError(error: string | null): boolean {
  return isNetworkError(error);
}
