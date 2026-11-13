import { jsonResponse } from '@/shared/testing/test-fixtures';
import { mockApi } from './mock-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mockApi', () => {
  it('[TC-02-02] dispatches by method and path and records requests', async () => {
    const { requests } = mockApi({
      'GET /api/a': jsonResponse({ ok: 'a' }),
      'POST /api/a': (request) => jsonResponse({ echoed: request.body }, 201),
    });

    const first = await fetch('/api/a');
    const second = await fetch('/api/a', {
      method: 'POST',
      body: JSON.stringify({ x: 1 }),
    });

    await expect(first.json()).resolves.toEqual({ ok: 'a' });
    expect(second.status).toBe(201);
    await expect(second.json()).resolves.toEqual({ echoed: { x: 1 } });
    expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'GET /api/a',
      'POST /api/a',
    ]);
  });

  it('[TC-02-02] serves a static response more than once', async () => {
    mockApi({ 'GET /api/a': jsonResponse({ ok: true }) });

    await fetch('/api/a');
    const again = await fetch('/api/a');

    await expect(again.json()).resolves.toEqual({ ok: true });
  });

  it('[TC-02-02] rejects an unmatched request', async () => {
    mockApi({});

    await expect(fetch('/api/missing')).rejects.toThrow(
      'Unmatched request: GET /api/missing',
    );
  });
});
