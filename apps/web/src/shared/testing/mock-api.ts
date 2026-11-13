export interface MockRequest {
  method: string;
  path: string;
  body: unknown;
}

type MockReply =
  Response | ((request: MockRequest) => Response | Promise<Response>);

function toMockRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
): MockRequest {
  return {
    method: init?.method ?? 'GET',
    path: String(input),
    body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
  };
}

/** Routes are keyed by `METHOD /path`; a static Response is cloned per call, unmatched requests reject. */
export function mockApi(routes: Record<string, MockReply>): {
  requests: MockRequest[];
} {
  const requests: MockRequest[] = [];

  vi.stubGlobal(
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const request = toMockRequest(input, init);
      requests.push(request);
      const reply = routes[`${request.method} ${request.path}`];
      if (reply === undefined) {
        throw new Error(`Unmatched request: ${request.method} ${request.path}`);
      }
      return reply instanceof Response ? reply.clone() : reply(request);
    },
  );

  return { requests };
}
