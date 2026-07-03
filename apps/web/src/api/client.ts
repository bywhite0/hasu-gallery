/**
 * Base API client with fetchJson helper
 * Handles JSON requests/responses and authentication via cookies
 */

const configuredBaseUrl = import.meta.env?.VITE_API_BASE_URL as string | undefined;
const localApiBaseUrl =
  typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://127.0.0.1:8787'
    : '';

export const BASE_URL = configuredBaseUrl || localApiBaseUrl;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Fetch JSON with automatic error handling
 * Includes credentials for session cookies
 */
export async function fetchJson<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Include session cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Parse JSON response (even for errors)
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error || data?.message || `HTTP ${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}
