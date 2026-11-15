import {
  MarkWordRequestSchema,
  type MarkWordRequest,
  type Word,
} from '@gototalk/shared';
import { mockApi } from '@/shared/testing/mock-api';
import { jsonResponse } from '@/shared/testing/http-responses';
import { testReport } from '@/shared/testing/fixtures/report';

type Reply = Response | Promise<Response>;
type Routes = Parameters<typeof mockApi>[0];

interface WordsApiOptions {
  words?: Word[];
  mark?: (id: string, body: MarkWordRequest) => Reply;
  extraRoutes?: Routes;
}

/** One route per word, keyed by the ids of `words`; the default reply echoes the word with the requested state. */
export function mockWordsApi({
  words = testReport().words,
  mark,
  extraRoutes = {},
}: WordsApiOptions = {}) {
  const echo = (word: Word, body: MarkWordRequest) =>
    jsonResponse({ ...word, state: body.state });
  const { requests } = mockApi({
    ...extraRoutes,
    ...Object.fromEntries(
      words.map((word) => [
        `PATCH /api/words/${word.id}`,
        (request: { body: unknown }) => {
          const body = MarkWordRequestSchema.parse(request.body);
          return mark ? mark(word.id, body) : echo(word, body);
        },
      ]),
    ),
  });
  return {
    requests,
    markRequests: () =>
      requests
        .filter((request) => request.method === 'PATCH')
        .map((request) => ({
          id: request.path.split('/').pop(),
          body: request.body,
        })),
  };
}
