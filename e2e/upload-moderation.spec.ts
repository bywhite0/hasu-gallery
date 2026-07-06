import { expect, test, type Page } from '@playwright/test';

const png1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

const uploadedWork = {
  id: 'upload-e2e-work',
  gallery: 'art',
  origin: null,
  title: 'Upload E2E Lotus Art',
  status: 'pending',
  uploader_name: 'Moderator',
  file: null,
  asset_file: 'upload-e2e-work.png',
  thumbnail_url: '',
  file_url: `data:image/png;base64,${png1x1.toString('base64')}`,
  width: 1,
  height: 1,
  source: '',
  source_url: 'https://example.com/source',
  rights_note: '',
  created_at: '2026-07-07T00:00:00.000Z',
  updated_at: '2026-07-07T00:00:00.000Z',
  art_meta: {
    artist: 'Local E2E Artist',
    medium: 'Digital',
    rating: 'all_ages',
  },
};

function queueResponse(works: unknown[]) {
  return {
    works,
    pagination: {
      page: 1,
      limit: 20,
      total: works.length,
      total_pages: works.length > 0 ? 1 : 0,
    },
  };
}

async function mockUploadModerationApi(page: Page) {
  const uploadRequests: string[] = [];
  const statusRequests: unknown[] = [];
  let pendingWorks: unknown[] = [];

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/api/auth/me') {
      await route.fulfill({
        json: {
          id: 1,
          handle: 'moderator',
          email: 'moderator@example.test',
          display_name: 'Moderator',
          role: 'moderator',
          created_at: '2026-07-07T00:00:00.000Z',
        },
      });
      return;
    }

    if (url.pathname === '/api/works/upload' && request.method() === 'POST') {
      const contentType = request.headers()['content-type'] ?? '';
      const body = request.postData() ?? '';

      expect(contentType).toContain('multipart/form-data');
      expect(body).toContain('name="title"');
      expect(body).toContain(uploadedWork.title);
      expect(body).toContain('name="gallery"');
      expect(body).toContain('art');
      expect(body).toContain('name="artist"');
      expect(body).toContain(uploadedWork.art_meta.artist);
      expect(body).toContain('name="source_url"');
      expect(body).toContain(uploadedWork.source_url);

      uploadRequests.push(body);
      pendingWorks = [
        {
          id: uploadedWork.id,
          title: uploadedWork.title,
          gallery: uploadedWork.gallery,
          status: uploadedWork.status,
          uploader_handle: 'moderator',
          file_url: uploadedWork.file_url,
          source_url: uploadedWork.source_url,
          created_at: uploadedWork.created_at,
          dimensions: '1x1',
          file_size_bytes: png1x1.length,
        },
      ];

      await route.fulfill({ json: uploadedWork });
      return;
    }

    if (url.pathname === '/api/moderation/queue') {
      const gallery = url.searchParams.get('gallery');
      const works = gallery === 'art' ? pendingWorks : [];
      await route.fulfill({ json: queueResponse(works) });
      return;
    }

    if (url.pathname === `/api/works/${uploadedWork.id}/status` && request.method() === 'PATCH') {
      const payload = request.postDataJSON();
      expect(payload).toMatchObject({
        status: 'approved',
        note: 'Looks good for local E2E.',
      });

      statusRequests.push(payload);
      pendingWorks = [];

      await route.fulfill({
        json: {
          id: uploadedWork.id,
          status: 'approved',
          updated_at: '2026-07-07T00:01:00.000Z',
        },
      });
      return;
    }

    await route.abort();
  });

  return { uploadRequests, statusRequests };
}

test('Upload submission appears in moderation and can be approved', async ({ page }) => {
  const requests = await mockUploadModerationApi(page);

  await page.goto('/upload');

  await page
    .getByLabel('Choose an image file to upload')
    .setInputFiles({
      name: 'lotus-upload.png',
      mimeType: 'image/png',
      buffer: png1x1,
    });
  await expect(page.getByText('lotus-upload.png')).toBeVisible();

  await page.getByLabel('Title').fill(uploadedWork.title);
  await page.getByLabel('Gallery').selectOption('art');
  await page.getByLabel('Artist').fill(uploadedWork.art_meta.artist);
  await page.getByLabel('Medium').fill(uploadedWork.art_meta.medium);
  await page.getByLabel('Source URL').fill(uploadedWork.source_url);
  await page.getByRole('button', { name: 'Submit for review' }).click();

  await expect(page.getByRole('heading', { name: 'Upload submitted' })).toBeVisible();
  expect(requests.uploadRequests).toHaveLength(1);

  await page.goto('/moderation');
  await page.getByRole('combobox').first().selectOption('art');

  await expect(page.getByRole('heading', { name: uploadedWork.title })).toBeVisible();
  await page.getByLabel('Review note').fill('Looks good for local E2E.');
  await page.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('button', { name: 'Confirm approval' }).click();

  await expect(page.getByText('No pending submissions found.')).toBeVisible();
  expect(requests.statusRequests).toHaveLength(1);
});
