import type { Work } from '@hasu-gallery/types';

export async function uploadWork(formData: FormData): Promise<Work> {
  const response = await fetch('/api/works/upload', {
    method: 'POST',
    credentials: 'include',
    body: formData, // Don't set Content-Type, browser will set multipart boundary
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || error.message || 'Upload failed');
  }

  return response.json();
}
