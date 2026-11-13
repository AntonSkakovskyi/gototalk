import { ErrorResponseSchema } from '@gototalk/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = ErrorResponseSchema.safeParse(body);
  if (parsed.success) {
    return new ApiError(
      response.status,
      parsed.data.error.code,
      parsed.data.error.message,
    );
  }
  return new ApiError(
    response.status,
    'UNKNOWN_ERROR',
    response.statusText || `HTTP ${response.status}`,
  );
}
