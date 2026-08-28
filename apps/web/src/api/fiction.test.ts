import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFiction, listPublicFictions } from './fiction';
import { ApiError } from './client';

describe('fiction JSON client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('decodes public list responses without sending session credentials', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'fiction-1',
              title: 'A quiet orbit',
              summary: 'A short story.',
              content_rating: 'all_ages',
              cover_media_id: null,
              author_handle: 'reader',
              fandom: 'Hasu no Sora',
              language: 'en',
              word_count: 420,
              published_revision_id: 'revision-1',
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
          total_pages: 1,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await listPublicFictions({ query: 'orbit' });

    expect(result.items[0].title).toBe('A quiet orbit');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/fictions?q=orbit'),
      expect.objectContaining({ credentials: 'omit' }),
    );
  });

  it('encodes command bodies and decodes product-safe JSON errors', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ code: 'invalid_title', message: 'Title is required' }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(
      createFiction({
        title: '',
        synopsis: '',
        fandom: '',
        language: 'en',
        content_rating: 'all_ages',
        body: 'Body',
      }),
    ).rejects.toMatchObject({
      status: 400,
      data: expect.objectContaining({ code: 'invalid_title' }),
    });

    await expect(
      createFiction({
        title: '',
        synopsis: '',
        fandom: '',
        language: 'en',
        content_rating: 'all_ages',
        body: 'Body',
      }),
    ).rejects.toBeInstanceOf(ApiError);

    const [, request] = fetchMock.mock.calls[0];
    expect(request).toEqual(expect.objectContaining({ credentials: 'include' }));
    expect((request as RequestInit).headers).toEqual(
      expect.objectContaining({ 'Content-Type': 'application/json' }),
    );
    const body = JSON.parse((request as RequestInit).body as string);
    expect(body.language).toBe('en');
    expect(body.content_rating).toBe('all_ages');
  });
});
