import type { Transcript } from '@gototalk/shared';
import type { FakeSttFailMode } from '../../core/config/env.schema.js';
import { cleanTranscript } from './clean-transcript.js';
import { FAKE_TRANSCRIPTS } from './fake-transcripts.js';
import { SpeechRecognitionUnavailableError } from './speech-recognition.errors.js';
import type { SpeechRecognitionPort } from './speech-recognition.port.js';

export interface FakeSpeechRecognitionOptions {
  failMode?: FakeSttFailMode;
}

export class FakeSpeechRecognition implements SpeechRecognitionPort {
  private readonly failMode: FakeSttFailMode | undefined;
  private counter = 0;

  constructor(options: FakeSpeechRecognitionOptions = {}) {
    this.failMode = options.failMode;
  }

  reset(): void {
    this.counter = 0;
  }

  transcribe(
    _audio: Buffer,
    _mime: string,
    index?: number,
  ): Promise<Transcript> {
    if (this.failMode === 'unavailable') {
      return Promise.reject(new SpeechRecognitionUnavailableError());
    }
    const position = index ?? this.counter++;
    const size = FAKE_TRANSCRIPTS.length;
    const verbatim = FAKE_TRANSCRIPTS[((position % size) + size) % size]!;
    return Promise.resolve({ verbatim, clean: cleanTranscript(verbatim) });
  }
}
