import { ERROR_CODES } from '@gototalk/shared';
import {
  DIALOGUE_SESSION_ID,
  mockDialogueApi,
} from '@/shared/testing/dialogue-mocks';
import { mockApi } from '@/shared/testing/mock-api';
import {
  errorResponse,
  jsonResponse,
  testMistake,
  testSession,
  testTurnResult,
} from '@/shared/testing/test-fixtures';
import {
  analyzeAnswer,
  finishSession,
  markMistakeFalse,
  submitTextAnswer,
} from './dialogue-api';

const TURN = testTurnResult();
const BASE = `/api/sessions/${DIALOGUE_SESSION_ID}`;

describe('dialogue api', () => {
  it('[TC-04-04] submitTextAnswer posts the text and returns the pending utterance', async () => {
    const { requests } = mockDialogueApi();

    await expect(
      submitTextAnswer(DIALOGUE_SESSION_ID, 'I go to the offsite yesterday'),
    ).resolves.toEqual(TURN.utterance);

    expect(requests).toEqual([
      {
        method: 'POST',
        path: `${BASE}/utterances`,
        body: { text: 'I go to the offsite yesterday' },
      },
    ]);
  });

  it('[TC-04-04] analyzeAnswer posts without a body and returns the turn result', async () => {
    const { requests } = mockDialogueApi();

    await expect(
      analyzeAnswer(DIALOGUE_SESSION_ID, TURN.utterance.id),
    ).resolves.toEqual(TURN);

    expect(requests).toEqual([
      {
        method: 'POST',
        path: `${BASE}/utterances/${TURN.utterance.id}/analysis`,
        body: undefined,
      },
    ]);
  });

  it('[TC-04-04] markMistakeFalse patches the mistake and returns the updated view', async () => {
    const { requests } = mockDialogueApi();
    const mistake = testMistake();

    await expect(
      markMistakeFalse(DIALOGUE_SESSION_ID, mistake.id),
    ).resolves.toEqual({ ...mistake, isFalse: true });

    expect(requests).toEqual([
      {
        method: 'PATCH',
        path: `${BASE}/mistakes/${mistake.id}`,
        body: { isFalse: true },
      },
    ]);
  });

  it('[TC-04-05] finishSession posts without a body and returns the finished session', async () => {
    const { requests } = mockDialogueApi();

    await expect(finishSession(DIALOGUE_SESSION_ID)).resolves.toMatchObject({
      id: DIALOGUE_SESSION_ID,
      status: 'finished',
    });

    expect(requests).toEqual([
      { method: 'POST', path: `${BASE}/finish`, body: undefined },
    ]);
  });

  it('[TC-04-04] ids are URL-encoded', async () => {
    const { requests } = mockApi({
      'POST /api/sessions/a%2Fb/utterances/c%20d/analysis': jsonResponse(TURN),
    });

    await analyzeAnswer('a/b', 'c d');

    expect(requests[0]?.path).toBe(
      '/api/sessions/a%2Fb/utterances/c%20d/analysis',
    );
  });

  it.each([
    ['submitTextAnswer', () => submitTextAnswer(DIALOGUE_SESSION_ID, 'text')],
    [
      'analyzeAnswer',
      () => analyzeAnswer(DIALOGUE_SESSION_ID, TURN.utterance.id),
    ],
    [
      'markMistakeFalse',
      () => markMistakeFalse(DIALOGUE_SESSION_ID, testMistake().id),
    ],
    ['finishSession', () => finishSession(DIALOGUE_SESSION_ID)],
  ])(
    '[TC-04-04] %s rejects a response that breaks the contract',
    async (_name, call) => {
      mockDialogueApi({
        answer: () => jsonResponse({ id: 'not-a-uuid' }),
        analyze: () => jsonResponse({ utterance: TURN.utterance }),
        markMistake: () => jsonResponse({ ...testMistake(), end: 0 }),
        finish: () => jsonResponse({ ...testSession(), status: 'paused' }),
      });

      await expect(call()).rejects.toThrow();
    },
  );

  it('[TC-04-04] surfaces the API error code', async () => {
    mockDialogueApi({
      answer: () => errorResponse(409, ERROR_CODES.SESSION_FINISHED),
    });

    await expect(
      submitTextAnswer(DIALOGUE_SESSION_ID, 'text'),
    ).rejects.toMatchObject({
      status: 409,
      code: ERROR_CODES.SESSION_FINISHED,
    });
  });
});
