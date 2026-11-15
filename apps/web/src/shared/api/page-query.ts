interface PageQuery {
  cursor?: string | undefined;
  limit?: number | undefined;
}

export function pageQueryString({ cursor, limit }: PageQuery): string {
  const params = new URLSearchParams();
  if (cursor !== undefined) {
    params.set('cursor', cursor);
  }
  if (limit !== undefined) {
    params.set('limit', String(limit));
  }
  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}
