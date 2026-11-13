import { ApiError } from './api-error';
import { retryUnlessClientError } from './retry-policy';

describe('retryUnlessClientError', () => {
  const retry = retryUnlessClientError(2);

  it('[TC-03-03] never retries a 4xx response', () => {
    expect(retry(0, new ApiError(400, 'VALIDATION_ERROR', 'bad'))).toBe(false);
    expect(retry(0, new ApiError(499, 'CLIENT', 'edge'))).toBe(false);
  });

  it('[TC-03-03] retries a 5xx response until the limit', () => {
    const error = new ApiError(502, 'BAD_GATEWAY', 'down');

    expect(retry(0, error)).toBe(true);
    expect(retry(1, error)).toBe(true);
    expect(retry(2, error)).toBe(false);
  });

  it('[TC-03-03] retries a network failure until the limit', () => {
    const error = new TypeError('Failed to fetch');

    expect(retry(1, error)).toBe(true);
    expect(retry(2, error)).toBe(false);
  });

  it('[TC-03-03] treats a 500 as retryable and 400 as the lower client bound', () => {
    expect(retry(0, new ApiError(500, 'X', 'x'))).toBe(true);
    expect(retry(0, new ApiError(399, 'X', 'x'))).toBe(true);
  });
});
