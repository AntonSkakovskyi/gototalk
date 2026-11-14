import {
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ERROR_CODES } from '@gototalk/shared';
import type { Utterance } from '@gototalk/shared';
import { SpeechRecognitionUnavailableError } from '../../integrations/speech-recognition/speech-recognition.errors.js';
import { SPEECH_RECOGNITION_PORT } from '../../integrations/speech-recognition/speech-recognition.port.js';
import type { SpeechRecognitionPort } from '../../integrations/speech-recognition/speech-recognition.port.js';
import { isSessionId, sessionNotFound } from '../session/session.errors.js';
import { AudioRetention } from './audio-retention.js';
import type { UploadedAudio } from './audio-upload.js';
import {
  AnswerNotExpectedError,
  SessionFinishedError,
  SessionNotFoundError,
} from './dialogue.errors.js';
import { detectAudioFormat } from './lib/audio-format.js';
import { DialogueRepository } from './persistence/dialogue.repository.js';
import type { AnswerTexts } from './persistence/dialogue.repository.js';

function toHttpError(error: unknown): unknown {
  if (error instanceof SessionNotFoundError) return sessionNotFound();
  if (error instanceof SessionFinishedError) {
    return new ConflictException({
      code: ERROR_CODES.SESSION_FINISHED,
      message: 'The session is already finished',
    });
  }
  if (error instanceof AnswerNotExpectedError) {
    return new ConflictException({
      code: ERROR_CODES.ANSWER_NOT_EXPECTED,
      message: 'There is no open question to answer',
    });
  }
  if (error instanceof SpeechRecognitionUnavailableError) {
    return new ServiceUnavailableException({
      code: ERROR_CODES.SPEECH_RECOGNITION_UNAVAILABLE,
      message: error.message,
    });
  }
  return error;
}

@Injectable()
export class AnswersService {
  constructor(
    private readonly dialogue: DialogueRepository,
    @Inject(SPEECH_RECOGNITION_PORT)
    private readonly speech: SpeechRecognitionPort,
    private readonly retention: AudioRetention,
  ) {}

  async submit(
    userId: string,
    sessionId: string,
    answer: AnswerTexts,
  ): Promise<Utterance> {
    if (!isSessionId(sessionId)) throw sessionNotFound();
    try {
      return await this.dialogue.submitAnswer(userId, sessionId, answer);
    } catch (error) {
      throw toHttpError(error);
    }
  }

  /** The unlocked pre-check keeps audio away from the provider when the answer would be rejected anyway; the transcription runs outside any transaction. */
  async submitAudio(
    userId: string,
    sessionId: string,
    audio: UploadedAudio,
  ): Promise<Utterance> {
    if (!isSessionId(sessionId)) throw sessionNotFound();
    try {
      const index = await this.dialogue.answerIndexFor(userId, sessionId);
      const mime = detectAudioFormat(audio.mimetype, audio.buffer);
      if (!mime) {
        throw new UnsupportedMediaTypeException({
          code: ERROR_CODES.AUDIO_UNSUPPORTED,
          message: 'The audio format is not supported',
        });
      }
      const { verbatim, clean } = await this.speech.transcribe(
        audio.buffer,
        mime,
        index,
      );
      const utterance = await this.dialogue.submitAnswer(userId, sessionId, {
        verbatim,
        clean,
      });
      await this.retention.keep(utterance.id, mime, audio.buffer);
      return utterance;
    } catch (error) {
      throw toHttpError(error);
    }
  }
}
