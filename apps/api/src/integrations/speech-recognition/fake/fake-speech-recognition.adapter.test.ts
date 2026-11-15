import { describe, expect, it } from 'vitest';
import { TranscriptSchema } from '../transcript.js';
import type { SpeechRecognitionPort } from '../speech-recognition.port.js';
import { SpeechRecognitionUnavailableError } from '../speech-recognition.errors.js';
import { FAKE_TRANSCRIPTS } from './fake-transcripts.js';
import { FakeSpeechRecognition } from './fake-speech-recognition.js';

const audio = Buffer.from([1, 2, 3]);

const fakeStt = (): SpeechRecognitionPort => new FakeSpeechRecognition();

describe('FakeSpeechRecognition', () => {
  it('[TC-00-05] transcribe: the same index gives an identical result', async () => {
    const stt = fakeStt();
    const first = await stt.transcribe(audio, 'audio/webm', 2);
    const second = await stt.transcribe(audio, 'audio/webm', 2);

    expect(second).toEqual(first);
    expect(TranscriptSchema.parse(first)).toEqual(first);
  });

  it('[TC-00-05] transcribe: a fresh adapter starts with transcript #0 and ignores the audio content', async () => {
    const result = await fakeStt().transcribe(Buffer.alloc(0), 'audio/ogg');

    expect(result.verbatim).toBe(FAKE_TRANSCRIPTS[0]);
    expect(result.clean).toBe(
      'Yesterday I go to the office and I have a meeting with my team. I very like my job.',
    );
  });
});

describe('FakeSpeechRecognition fail modes', () => {
  it('[TC-04-08] unavailable: transcribe rejects with SpeechRecognitionUnavailableError', async () => {
    const stt: SpeechRecognitionPort = new FakeSpeechRecognition({
      failMode: 'unavailable',
    });

    const error: unknown = await stt
      .transcribe(audio, 'audio/webm')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SpeechRecognitionUnavailableError);
    expect((error as Error).name).toBe('SpeechRecognitionUnavailableError');
  });

  it('[TC-00-05] without a fail mode transcribe keeps working', async () => {
    const stt: SpeechRecognitionPort = new FakeSpeechRecognition({});

    const transcript = await stt.transcribe(audio, 'audio/webm');

    expect(transcript.verbatim).toContain('yesterday I go');
  });
});
