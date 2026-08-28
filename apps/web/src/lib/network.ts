// Browser network failures surface as TypeError with engine-specific text:
// Chromium "Failed to fetch", Firefox "NetworkError when attempting to fetch
// resource.", Safari "Load failed". Match all of them in one place.
const NETWORK_ERROR_PATTERN = /failed to fetch|networkerror|load failed/i;

export function isNetworkError(error: unknown): boolean {
  if (typeof error === 'string') return NETWORK_ERROR_PATTERN.test(error);
  if (error instanceof Error) return NETWORK_ERROR_PATTERN.test(error.message);
  return false;
}
