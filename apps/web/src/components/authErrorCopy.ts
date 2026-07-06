type AuthIntent = "login" | "register";

const NETWORK_ERROR_PATTERN = /failed to fetch|networkerror|load failed/i;

export function getAuthErrorMessage(error: string | null, intent: AuthIntent): string | null {
  if (!error) return null;

  if (NETWORK_ERROR_PATTERN.test(error)) {
    return "We could not reach the Hasu Gallery server. Check that the API is running, then try again.";
  }

  if (intent === "login" && /http 401|http 403|invalid/i.test(error)) {
    return "The handle or password does not match our records.";
  }

  if (intent === "register" && /http 409|already exists|duplicate/i.test(error)) {
    return "That handle or email is already in use. Try a different one or log in instead.";
  }

  if (/http 5\d\d/i.test(error)) {
    return "The server hit a problem. Please try again in a moment.";
  }

  return error;
}

export function isRecoverableAuthError(error: string | null): boolean {
  return Boolean(error && NETWORK_ERROR_PATTERN.test(error));
}
