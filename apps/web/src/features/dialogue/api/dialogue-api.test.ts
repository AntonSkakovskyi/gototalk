import { ERROR_CODES } from '@gototalk/shared';
import {
  DIALOGUE_SESSION_ID,
  HINT_PHRASE,
  HINT_TRANSLATION,
  mockDialogueApi,
} from '@/shared/testing/dialogue-mocks';
import { mockApi } from '@/shared/testing/mock-api';
import {
  errorResponse,
  jsonResponse,
  testSession,
  testTurnResult,
} from '@/shared/testing/test-fixtures';
import {
  analyzeAnswer,
  finishSession,
  requestHint,
  submitAudioAnswer,
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

  it('[TC-04-05] submitAudioAnswer uploads the blob as the audio field and returns the pending utterance', async () => {
    const api = mockDialogueApi();
    const blob = new Blob(['voice'], { type: 'audio/webm;codecs=opus' });

    await expect(submitAudioAnswer(DIALOGUE_SESSION_ID, blob)).resolves.toEqual(
      TURN.utterance,
    );

    expect(api.requests).toHaveLength(1);
    expect(api.requests[0]).toMatchObject({
      method: 'POST',
      path: `${BASE}/utterances`,
    });
    const [file] = api.audioRequests();
    expect(file?.name).toBe('answer.webm');
    expect(file?.type).toBe('audio/webm;codecs=opus');
    await expect(file?.text()).resolves.toBe('voice');
  });

  it.each([
    ['audio/ogg;codecs=opus', 'answer.ogg'],
    ['audio/mp4', 'answer.m4a'],
  ])(
    '[TC-04-05] submitAudioAnswer names a %s upload %s',
    async (type, name) => {
      const api = mockDialogueApi();

      await submitAudioAnswer(DIALOGUE_SESSION_ID, new Blob(['v'], { type }));

      expect(api.audioRequests()[0]?.name).toBe(name);
    },
  );

  it.each([
    [503, ERROR_CODES.SPEECH_RECOGNITION_UNAVAILABLE],
    [413, ERROR_CODES.AUDIO_TOO_LARGE],
    [415, ERROR_CODES.AUDIO_UNSUPPORTED],
  ])(
    '[TC-04-08] submitAudioAnswer surfaces the %i %s error',
    async (status, code) => {
      mockDialogueApi({ voiceAnswer: () => errorResponse(status, code) });

      await expect(
        submitAudioAnswer(DIALOGUE_SESSION_ID, new Blob(['v'])),
      ).rejects.toMatchObject({ status, code });
    },
  );

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

  it('[TC-04-04] finishSession posts without a body and returns the finished session', async () => {
    const { requests } = mockDialogueApi();

    await expect(finishSession(DIALOGUE_SESSION_ID)).resolves.toMatchObject({
      id: DIALOGUE_SESSION_ID,
      status: 'finished',
    });

    expect(requests).toEqual([
      { method: 'POST', path: `${BASE}/finish`, body: undefined },
    ]);
  });

  it('[TC-04-05] requestHint posts the phrase start request and returns the phrase', async () => {
    const { requests } = mockDialogueApi();

    await expect(
      requestHint(DIALOGUE_SESSION_ID, { kind: 'phrase_start' }),
    ).resolves.toEqual({ kind: 'phrase_start', text: HINT_PHRASE });

    expect(requests).toEqual([
      {
        method: 'POST',
        path: `${BASE}/hints`,
        body: { kind: 'phrase_start' },
      },
    ]);
  });

  it('[TC-04-10] requestHint posts the word and returns the translation', async () => {
    const api = mockDialogueApi();

    await expect(
      requestHint(DIALOGUE_SESSION_ID, {
        kind: 'translation',
        word: 'зустріч',
      }),
    ).resolves.toEqual({ kind: 'translation', word: HINT_TRANSLATION });

    expect(api.hintRequests()).toEqual([
      { kind: 'translation', word: 'зустріч' },
    ]);
  });

  it('[TC-04-10] requestHint returns a null word for an unknown word', async () => {
    mockDialogueApi({
      hint: () => jsonResponse({ kind: 'translation', word: null }),
    });

    await expect(
      requestHint(DIALOGUE_SESSION_ID, { kind: 'translation', word: 'щось' }),
    ).resolves.toEqual({ kind: 'translation', word: null });
  });

  it.each([
    [503, ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE],
    [502, ERROR_CODES.LANGUAGE_MODEL_INVALID_RESPONSE],
    [409, ERROR_CODES.SESSION_FINISHED],
  ])(
    '[TC-04-10] requestHint surfaces the %i %s error',
    async (status, code) => {
      mockDialogueApi({ hint: () => errorResponse(status, code) });

      await expect(
        requestHint(DIALOGUE_SESSION_ID, { kind: 'phrase_start' }),
      ).rejects.toMatchObject({ status, code });
    },
  );

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
      'submitAudioAnswer',
      () => submitAudioAnswer(DIALOGUE_SESSION_ID, new Blob(['v'])),
    ],
    [
      'analyzeAnswer',
      () => analyzeAnswer(DIALOGUE_SESSION_ID, TURN.utterance.id),
    ],
    ['finishSession', () => finishSession(DIALOGUE_SESSION_ID)],
    [
      'requestHint',
      () => requestHint(DIALOGUE_SESSION_ID, { kind: 'phrase_start' }),
    ],
  ])(
    '[TC-04-04] %s rejects a response that breaks the contract',
    async (_name, call) => {
      mockDialogueApi({
        answer: () => jsonResponse({ id: 'not-a-uuid' }),
        voiceAnswer: () => jsonResponse({ id: 'not-a-uuid' }),
        analyze: () => jsonResponse({ utterance: TURN.utterance }),
        finish: () => jsonResponse({ ...testSession(), status: 'paused' }),
        hint: () => jsonResponse({ kind: 'phrase_start', text: '' }),
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
