import type { Transcript } from '@gototalk/shared';
import type { SpeechRecognitionPort } from '../../ports/speech-recognition.port.js';

const VERBATIM =
  'Um, yesterday I go to the office and, uh, I have a meeting with my team. I very like my job.';
const CLEAN =
  'Yesterday I go to the office and I have a meeting with my team. I very like my job.';

export class FakeSpeechRecognition implements SpeechRecognitionPort {
  transcribe(): Promise<Transcript> {
    return Promise.resolve({ verbatim: VERBATIM, clean: CLEAN });
  }
}
