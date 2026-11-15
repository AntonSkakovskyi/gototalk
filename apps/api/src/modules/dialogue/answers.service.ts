import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import {
  ANSWER_TEXT_MAX,
  AnswerTextRequestSchema,
  ERROR_CODES,
} from '@gototalk/shared';
import { TranscriptSchema } from '../../integrations/speech-recognition/transcript.js';
import type { Utterance } from '@gototalk/shared';
import { ZodBodyPipe } from '../../common/pipes/zod-body.pipe.js';
import { SpeechRecognitionUnavailableError } from '../../integrations/speech-recognition/speech-recognition.errors.js';
import { SPEECH_RECOGNITION_PORT } from '../../integrations/speech-recognition/speech-recognition.port.js';
import type { SpeechRecognitionPort } from '../../integrations/speech-recognition/speech-recognition.port.js';
import { isSessionId, sessionNotFound } from '../session/session.errors.js';
import { AudioRetention } from './audio-retention.js';
import type { UploadedAudio } from './audio-upload.js';
import { toDialogueHttpError } from './dialogue.errors.js';
import { detectAudioFormat } from './lib/audio-format.js';
import { DialogueRepository } from './persistence/dialogue.repository.js';
import type { AnswerTexts } from './persistence/dialogue.repository.js';

function storable(text: string): string {
  return text.trim().slice(0, ANSWER_TEXT_MAX).trimEnd();
}

function toAnswerTexts(result: unknown): AnswerTexts {
  const parsed = TranscriptSchema.safeParse(result);
  if (!parsed.success) throw new SpeechRecognitionUnavailableError();
  const verbatim = storable(parsed.data.verbatim);
  const clean = storable(parsed.data.clean);
  if (verbatim === '' || clean === '') {
    throw new UnprocessableEntityException({
      code: ERROR_CODES.TRANSCRIPT_EMPTY,
      message: 'No speech was recognised in the recording',
    });
  }
  return { verbatim, clean };
}

function toHttpError(error: unknown): unknown {
  if (error instanceof SpeechRecognitionUnavailableError) {
    return new ServiceUnavailableException({
      code: ERROR_CODES.SPEECH_RECOGNITION_UNAVAILABLE,
      message: error.message,
    });
  }
  return toDialogueHttpError(error);
}

@Injectable()
export class AnswersService {
  constructor(
    private readonly dialogue: DialogueRepository,
    @Inject(SPEECH_RECOGNITION_PORT)
    private readonly speech: SpeechRecognitionPort,
    private readonly retention: AudioRetention,
  ) {}

  async answer(
    userId: string,
    sessionId: string,
    { audio, body }: { audio: UploadedAudio | undefined; body: unknown },
  ): Promise<Utterance> {
    if (audio) return this.submitAudio(userId, sessionId, audio);
    const { text } = new ZodBodyPipe(AnswerTextRequestSchema).transform(body);
    return this.submit(userId, sessionId, { verbatim: text, clean: text });
  }

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

  /** Unlocked pre-check; STT must run outside the transaction. */
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
      const answer = toAnswerTexts(
        await this.speech.transcribe(audio.buffer, mime, index),
      );
      const utterance = await this.dialogue.submitAnswer(
        userId,
        sessionId,
        answer,
      );
      await this.retention.keep(utterance.id, mime, audio.buffer);
      return utterance;
    } catch (error) {
      throw toHttpError(error);
    }
  }
}
