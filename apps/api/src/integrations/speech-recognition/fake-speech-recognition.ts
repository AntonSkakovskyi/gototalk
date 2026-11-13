import type { Transcript } from '@gototalk/shared';
import type { FakeSttFailMode } from '../../core/config/env.schema.js';
import { SpeechRecognitionUnavailableError } from './speech-recognition.errors.js';
import type { SpeechRecognitionPort } from './speech-recognition.port.js';

const VERBATIM =
  'Um, yesterday I go to the office and, uh, I have a meeting with my team. I very like my job.';
const CLEAN =
  'Yesterday I go to the office and I have a meeting with my team. I very like my job.';

export interface FakeSpeechRecognitionOptions {
  failMode?: FakeSttFailMode;
}

export class FakeSpeechRecognition implements SpeechRecognitionPort {
  private readonly failMode: FakeSttFailMode | undefined;

  constructor(options: FakeSpeechRecognitionOptions = {}) {
    this.failMode = options.failMode;
  }

  transcribe(): Promise<Transcript> {
    if (this.failMode === 'unavailable') {
      return Promise.reject(new SpeechRecognitionUnavailableError());
    }
    return Promise.resolve({ verbatim: VERBATIM, clean: CLEAN });
  }
}
