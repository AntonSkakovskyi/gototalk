export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(
  status: number,
  code: string,
  message = 'Error message',
): Response {
  return jsonResponse({ error: { code, message } }, status);
}

export function emptyResponse(status = 204): Response {
  return new Response(null, { status });
}

export const EMPTY_SESSIONS_ROUTE = {
  'GET /api/sessions': jsonResponse([]),
};

export const EMPTY_WORDS_ROUTE = {
  'GET /api/words': jsonResponse({ items: [], nextCursor: null }),
};
