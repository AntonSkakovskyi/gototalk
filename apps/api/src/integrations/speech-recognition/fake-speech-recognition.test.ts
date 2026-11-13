import { TranscriptSchema } from '@gototalk/shared';
import { describe, expect, it } from 'vitest';
import { FakeSpeechRecognition } from './fake-speech-recognition.js';
import { FAKE_TRANSCRIPTS } from './fake-transcripts.js';

const audio = Buffer.from([1, 2, 3]);

const CLEAN = [
  'Yesterday I go to the office and I have a meeting with my team. I very like my job.',
  'I am agree that remote work is good. I work with small team since 2 years.',
  'My sister she work in a big company. She busy every day.',
  'I have 25 years and I live in Kyiv. It depends of the weather if I will have time, I travel.',
  'We have a meeting in Monday and I need more informations. I am boring because it is long.',
];

const transcribeAll = async (stt: FakeSpeechRecognition, count: number) => {
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(await stt.transcribe(audio, 'audio/webm'));
  }
  return results;
};

describe('FakeSpeechRecognition', () => {
  it('[TC-04-01] has five canned transcripts', () => {
    expect(FAKE_TRANSCRIPTS).toHaveLength(5);
    expect(CLEAN).toHaveLength(5);
  });

  it.each(CLEAN.map((clean, i) => [i, clean] as const))(
    '[TC-04-01] transcript #%i has the expected clean text without fillers or stray spaces',
    async (index, clean) => {
      const result = await new FakeSpeechRecognition().transcribe(
        audio,
        'audio/webm',
        index,
      );

      expect(result.verbatim).toBe(FAKE_TRANSCRIPTS[index]);
      expect(result.clean).toBe(clean);
      expect(result.clean).not.toMatch(/\b(?:um|uh|er)\b/i);
      expect(result.clean).not.toMatch(/\bwell,/i);
      expect(result.clean).not.toContain('  ');
      expect(result.clean).not.toContain(' ,');
      expect(TranscriptSchema.parse(result)).toEqual(result);
    },
  );

  it('[TC-04-01] the internal counter cycles through 0..4 and wraps to 0', async () => {
    const results = await transcribeAll(new FakeSpeechRecognition(), 6);

    expect(results.map((r) => r.verbatim)).toEqual([
      ...FAKE_TRANSCRIPTS,
      FAKE_TRANSCRIPTS[0],
    ]);
  });

  it('[TC-04-01] an explicit index picks the transcript modulo 5', async () => {
    const stt = new FakeSpeechRecognition();

    expect((await stt.transcribe(audio, 'audio/webm', 7)).verbatim).toBe(
      FAKE_TRANSCRIPTS[2],
    );
    expect((await stt.transcribe(audio, 'audio/webm', 0)).verbatim).toBe(
      FAKE_TRANSCRIPTS[0],
    );
  });

  it('[TC-04-01] an explicit index does not advance the internal counter', async () => {
    const stt = new FakeSpeechRecognition();
    await stt.transcribe(audio, 'audio/webm', 3);
    await stt.transcribe(audio, 'audio/webm', 4);

    const next = await stt.transcribe(audio, 'audio/webm');

    expect(next.verbatim).toBe(FAKE_TRANSCRIPTS[0]);
  });

  it('[TC-00-05] reset() restarts the counter and gives the same sequence again', async () => {
    const stt = new FakeSpeechRecognition();
    const first = await transcribeAll(stt, 3);

    stt.reset();
    const second = await transcribeAll(stt, 3);

    expect(second).toEqual(first);
  });

  it('[TC-00-05] two fresh adapters produce the same sequence and the audio content is ignored', async () => {
    const a = await new FakeSpeechRecognition().transcribe(audio, 'audio/webm');
    const b = await new FakeSpeechRecognition().transcribe(
      Buffer.alloc(0),
      'audio/ogg',
    );

    expect(b).toEqual(a);
  });

  it('[TC-04-08] unavailable: rejects with or without an index', async () => {
    const failing = new FakeSpeechRecognition({ failMode: 'unavailable' });

    await expect(failing.transcribe(audio, 'audio/webm')).rejects.toThrow();
    await expect(
      failing.transcribe(audio, 'audio/webm', 1),
    ).rejects.toThrow();
  });
});
