import {
  create,
  ErrorResponseSchema,
  fromBinary,
  PROTO_MEDIA_TYPE,
  toBinary,
  type DescMessage,
  type ErrorResponse,
  type MessageInitShape,
  type MessageShape,
} from '@hasu-gallery/proto';
import { ApiError, BASE_URL } from './client';

export class ProtobufApiError extends ApiError {
  constructor(
    message: string,
    status: number,
    public code: string,
    public details?: ErrorResponse,
  ) {
    super(message, status, details);
    this.name = 'ProtobufApiError';
  }
}

function decodeError(bytes: Uint8Array, status: number) {
  try {
    const error = fromBinary(ErrorResponseSchema, bytes);
    return new ProtobufApiError(
      error.message || `HTTP ${status}`,
      status,
      error.code || 'unknown_error',
      error,
    );
  } catch {
    return new ProtobufApiError(`HTTP ${status}`, status, 'invalid_error_response');
  }
}

export async function fetchProtobuf<Desc extends DescMessage>(
  path: string,
  schema: Desc,
  options: RequestInit = {},
): Promise<MessageShape<Desc>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: options.credentials ?? 'include',
    headers: {
      Accept: PROTO_MEDIA_TYPE,
      ...options.headers,
    },
  });
  const bytes = new Uint8Array(await response.arrayBuffer());

  if (!response.ok) {
    throw decodeError(bytes, response.status);
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim();
  if (contentType !== PROTO_MEDIA_TYPE) {
    throw new ProtobufApiError(
      'The server returned an unexpected response format.',
      response.status,
      'invalid_response_media_type',
    );
  }

  try {
    return fromBinary(schema, bytes);
  } catch {
    throw new ProtobufApiError(
      'The server returned an unreadable response.',
      response.status,
      'invalid_protobuf_response',
    );
  }
}

export function protobufCommand<Desc extends DescMessage>(
  schema: Desc,
  value: MessageInitShape<Desc>,
): RequestInit {
  const message = create(schema, value);

  return {
    body: toBinary(schema, message) as BodyInit,
    headers: {
      Accept: PROTO_MEDIA_TYPE,
      'Content-Type': PROTO_MEDIA_TYPE,
    },
  };
}
