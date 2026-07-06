import { expect, test, type Page } from '@playwright/test';

const artFacets = {
  artists: [
    { value: 'Acceptance Artist', label: 'Acceptance Artist', count: 2 },
    { value: 'Guest Artist', label: 'Guest Artist', count: 1 },
  ],
  media: [
    { value: 'Digital', label: 'Digital', count: 2 },
    { value: 'Watercolor', label: 'Watercolor', count: 1 },
  ],
  ratings: [
    { value: 'all_ages', label: 'All Ages', count: 1 },
    { value: 'r15', label: 'R-15', count: 2 },
  ],
};

const worksByRating = {
  all_ages: [
    {
      id: 'all-ages-work',
      gallery: 'art',
      origin: null,
      title: 'All Ages Example',
      status: 'approved',
      thumbnail_url: '',
      file_url: 'https://assets.example/all-ages.png',
      width: 32,
      height: 32,
      created_at: '2026-07-07T00:00:00.000Z',
    },
  ],
  r15: [
    {
      id: 'r15-work-a',
      gallery: 'art',
      origin: null,
      title: 'R-15 Example A',
      status: 'approved',
      thumbnail_url: '',
      file_url: 'https://assets.example/r15-a.png',
      width: 64,
      height: 64,
      created_at: '2026-07-07T00:01:00.000Z',
    },
    {
      id: 'r15-work-b',
      gallery: 'art',
      origin: null,
      title: 'R-15 Example B',
      status: 'approved',
      thumbnail_url: '',
      file_url: 'https://assets.example/r15-b.png',
      width: 48,
      height: 48,
      created_at: '2026-07-07T00:02:00.000Z',
    },
  ],
};

async function mockArtGalleryApi(page: Page) {
  const worksRequests: URL[] = [];

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/auth/me') {
      await route.fulfill({ json: null });
      return;
    }

    if (url.pathname === '/api/works/facets') {
      await route.fulfill({ json: artFacets });
      return;
    }

    if (url.pathname === '/api/works') {
      worksRequests.push(url);
      const rating = url.searchParams.get('rating') === 'r15' ? 'r15' : 'all_ages';
      const works = worksByRating[rating];

      await route.fulfill({
        json: {
          works,
          pagination: {
            page: 1,
            limit: 24,
            total: works.length,
            total_pages: 1,
          },
        },
      });
      return;
    }

    await route.abort();
  });

  return worksRequests;
}

test('Art Gallery facets drive rating filtering and persisted preference restore', async ({ page }) => {
  const worksRequests = await mockArtGalleryApi(page);

  await page.goto('/gallery/art');

  const rating = page.getByLabel('Rating');
  await expect(rating).toHaveValue('all_ages');
  await expect(rating.locator('option[value="all_ages"]')).toHaveText('All Ages (1)');
  await expect(rating.locator('option[value="r15"]')).toHaveText('R-15 (2)');
  await expect(page.getByRole('heading', { name: 'All Ages Example' })).toBeVisible();
  await expect(page.getByLabel('Artist')).toHaveAttribute('list', 'artist-filter-options');
  await expect(page.getByLabel('Medium')).toHaveAttribute('list', 'medium-filter-options');

  await rating.selectOption('r15');

  await expect(page.getByRole('heading', { name: 'R-15 Example A' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'R-15 Example B' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear filters' })).toBeVisible();

  const storedPreference = await page.evaluate(() =>
    window.localStorage.getItem('hasu-gallery-preferences'),
  );
  expect(storedPreference).toContain('"artRatingPreference":"r15"');

  await page.reload();

  await expect(page.getByLabel('Rating')).toHaveValue('r15');
  await expect(page.getByRole('heading', { name: 'R-15 Example A' })).toBeVisible();
  expect(worksRequests.some((url) => url.searchParams.get('rating') === 'r15')).toBe(true);
});
