import {
  DIALOGUE_SESSION_ID,
  mockDialogueApi,
} from '@/shared/testing/dialogue-mocks';
import { jsonResponse, testMistake } from '@/shared/testing/test-fixtures';
import { markMistakeFalse } from './mistakes';

describe('mistakes api', () => {
  it('[TC-04-04] markMistakeFalse patches the mistake and returns the updated view', async () => {
    const { requests } = mockDialogueApi();
    const mistake = testMistake();

    await expect(
      markMistakeFalse(DIALOGUE_SESSION_ID, mistake.id),
    ).resolves.toEqual({ ...mistake, isFalse: true });

    expect(requests).toEqual([
      {
        method: 'PATCH',
        path: `/api/sessions/${DIALOGUE_SESSION_ID}/mistakes/${mistake.id}`,
        body: { isFalse: true },
      },
    ]);
  });

  it('[TC-04-04] markMistakeFalse rejects a response that breaks the contract', async () => {
    mockDialogueApi({
      markMistake: () => jsonResponse({ ...testMistake(), end: 0 }),
    });

    await expect(
      markMistakeFalse(DIALOGUE_SESSION_ID, testMistake().id),
    ).rejects.toThrow();
  });

  it('[TC-04-04] markMistakeFalse URL-encodes the ids', async () => {
    const { requests } = mockDialogueApi();

    await markMistakeFalse('a/b', 'c d').catch(() => undefined);

    expect(requests[0]?.path).toBe('/api/sessions/a%2Fb/mistakes/c%20d');
  });
});
