import { create, fromBinary, toBinary, ContentRating, CreateFictionRequestSchema, ErrorResponseSchema, PublicFictionListResponseSchema } from '@hasu-gallery/proto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFiction, listPublicFictions } from './fiction';

describe('fiction protobuf client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('decodes public list responses without sending session credentials', async () => {
    const response = create(PublicFictionListResponseSchema, {
      items: [
        {
          id: 'fiction-1',
          title: 'A quiet orbit',
          summary: 'A short story.',
          authorHandle: 'reader',
          fandom: 'Hasu no Sora',
          language: 'en',
          wordCount: 420,
        },
      ],
      page: 1,
      limit: 20,
      total: 1n,
      totalPages: 1,
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(toBinary(PublicFictionListResponseSchema, response), {
        status: 200,
        headers: { 'content-type': 'application/vnd.hasu-gallery.v2+protobuf' },
      }),
    );

    const result = await listPublicFictions({ query: 'orbit' });

    expect(result.items[0].title).toBe('A quiet orbit');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v2/public/fictions?q=orbit'),
      expect.objectContaining({ credentials: 'omit' }),
    );
  });

  it('encodes command bodies and decodes product-safe protobuf errors', async () => {
    const error = create(ErrorResponseSchema, {
      code: 'invalid_title',
      messageKey: 'error.invalid_title',
      message: 'Title is required',
      requestId: 'request-1',
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(toBinary(ErrorResponseSchema, error), {
        status: 400,
        headers: { 'content-type': 'application/vnd.hasu-gallery.v2+protobuf' },
      }),
    );

    await expect(
      createFiction({
        title: '',
        synopsis: '',
        fandom: '',
        language: 'en',
        contentRating: ContentRating.ALL_AGES,
        body: 'Body',
      }),
    ).rejects.toMatchObject({ code: 'invalid_title', status: 400 });

    const [, request] = fetchMock.mock.calls[0];
    expect(request).toEqual(expect.objectContaining({ credentials: 'include' }));
    expect((request as RequestInit).headers).toEqual(expect.objectContaining({
      Accept: 'application/vnd.hasu-gallery.v2+protobuf',
      'Content-Type': 'application/vnd.hasu-gallery.v2+protobuf',
    }));
    const body = new Uint8Array((request as RequestInit).body as ArrayBuffer);
    expect(fromBinary(CreateFictionRequestSchema, body).language).toBe('en');
  });
});
