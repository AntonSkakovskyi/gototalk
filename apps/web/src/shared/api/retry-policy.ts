import { ApiError } from './api-error';

export function retryUnlessClientError(maxRetries: number) {
  return (failureCount: number, error: Error): boolean => {
    const isClientError =
      error instanceof ApiError && error.status >= 400 && error.status < 500;
    return !isClientError && failureCount < maxRetries;
  };
}
