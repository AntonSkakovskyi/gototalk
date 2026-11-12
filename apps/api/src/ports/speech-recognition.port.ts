import type { Transcript } from '@gototalk/shared';

export const SPEECH_RECOGNITION_PORT = Symbol('SPEECH_RECOGNITION_PORT');

export interface SpeechRecognitionPort {
  /** index selects the canned answer in the fake adapter; real adapters ignore it. */
  transcribe(audio: Buffer, mime: string, index?: number): Promise<Transcript>;
}
