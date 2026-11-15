import 'reflect-metadata';
import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ANSWER_TEXT_MAX, ERROR_CODES } from '@gototalk/shared';
import type { Utterance } from '@gototalk/shared';
import { describe, expect, it, vi } from 'vitest';
import { SpeechRecognitionUnavailableError } from '../../integrations/speech-recognition/speech-recognition.errors.js';
import { AnswersService } from './answers.service.js';
import type { AudioRetention } from './audio/audio-retention.js';
import {
  AnswerNotExpectedError,
  SessionFinishedError,
  SessionNotFoundError,
} from '../session/session.errors.js';
import type { DialogueRepository } from './persistence/dialogue.repository.js';
import type { SpeechRecognitionPort } from '../../integrations/speech-recognition/speech-recognition.port.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const ANSWER = { verbatim: 'I very like it', clean: 'I very like it' };
const UTTERANCE: Utterance = {
  id: '44444444-4444-4444-8444-444444444444',
  seq: 2,
  role: 'user',
  text: ANSWER.verbatim,
  analysisStatus: 'pending',
  mistakes: [],
  better: [],
};

function setup(submitAnswer: unknown) {
  const repository = { submitAnswer };
  return new AnswersService(
    repository as unknown as DialogueRepository,
    { transcribe: vi.fn() },
    { keep: vi.fn() } as unknown as AudioRetention,
  );
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error,
  );
}

describe('AnswersService.submit', () => {
  it('[TC-04-03] returns the stored utterance and passes the answer to the repository', async () => {
    const submitAnswer = vi.fn().mockResolvedValue(UTTERANCE);

    await expect(
      setup(submitAnswer).submit(USER_ID, SESSION_ID, ANSWER),
    ).resolves.toEqual(UTTERANCE);
    expect(submitAnswer).toHaveBeenCalledWith(USER_ID, SESSION_ID, ANSWER);
  });

  it('[TC-04-03] answers 404 SESSION_NOT_FOUND for a non-uuid id without touching the repository', async () => {
    const submitAnswer = vi.fn();

    const error = await rejection(
      setup(submitAnswer).submit(USER_ID, 'not-a-uuid', ANSWER),
    );

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toMatchObject({
      code: ERROR_CODES.SESSION_NOT_FOUND,
    });
    expect(submitAnswer).not.toHaveBeenCalled();
  });

  it.each([
    [new SessionNotFoundError(), NotFoundException, 'SESSION_NOT_FOUND'],
    [new SessionFinishedError(), ConflictException, 'SESSION_FINISHED'],
    [new AnswerNotExpectedError(), ConflictException, 'ANSWER_NOT_EXPECTED'],
  ])('[TC-04-03] maps %s to %s with code %s', async (domain, type, code) => {
    const error = await rejection(
      setup(vi.fn().mockRejectedValue(domain)).submit(
        USER_ID,
        SESSION_ID,
        ANSWER,
      ),
    );

    expect(error).toBeInstanceOf(type);
    const body = (error as NotFoundException | ConflictException).getResponse();
    expect(body).toMatchObject({ code });
    expect(JSON.stringify(body)).not.toContain(ANSWER.verbatim);
  });

  it('[TC-04-03] rethrows unknown errors unchanged', async () => {
    const failure = new Error('db down');

    await expect(
      setup(vi.fn().mockRejectedValue(failure)).submit(
        USER_ID,
        SESSION_ID,
        ANSWER,
      ),
    ).rejects.toBe(failure);
  });
});

const WEBM = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42]);
const AUDIO = { buffer: WEBM, mimetype: 'audio/webm;codecs=opus' };
const TRANSCRIPT = { verbatim: 'Um, I go there', clean: 'I go there' };

function setupVoice(
  overrides: {
    answerIndexFor?: unknown;
    submitAnswer?: unknown;
    transcribe?: unknown;
  } = {},
) {
  const repository = {
    answerIndexFor: overrides.answerIndexFor ?? vi.fn().mockResolvedValue(3),
    submitAnswer:
      overrides.submitAnswer ?? vi.fn().mockResolvedValue(UTTERANCE),
  };
  const speech = {
    transcribe: overrides.transcribe ?? vi.fn().mockResolvedValue(TRANSCRIPT),
  };
  const retention = { keep: vi.fn().mockResolvedValue(undefined) };
  const service = new AnswersService(
    repository as unknown as DialogueRepository,
    speech as unknown as SpeechRecognitionPort,
    retention as unknown as AudioRetention,
  );
  return { service, repository, speech, retention };
}

describe('AnswersService.submitAudio', () => {
  it('[TC-04-02] transcribes with the user utterance count and stores both transcript texts', async () => {
    const { service, repository, speech, retention } = setupVoice();

    await expect(
      service.submitAudio(USER_ID, SESSION_ID, AUDIO),
    ).resolves.toEqual(UTTERANCE);

    expect(speech.transcribe).toHaveBeenCalledWith(WEBM, 'audio/webm', 3);
    expect(repository.submitAnswer).toHaveBeenCalledWith(
      USER_ID,
      SESSION_ID,
      TRANSCRIPT,
    );
    expect(retention.keep).toHaveBeenCalledWith(
      UTTERANCE.id,
      'audio/webm',
      WEBM,
    );
  });

  it('[TC-04-02] answers 404 for a non-uuid id before any lookup', async () => {
    const { service, repository, speech } = setupVoice();

    const error = await rejection(
      service.submitAudio(USER_ID, 'not-a-uuid', AUDIO),
    );

    expect(error).toBeInstanceOf(NotFoundException);
    expect(repository.answerIndexFor).not.toHaveBeenCalled();
    expect(speech.transcribe).not.toHaveBeenCalled();
  });

  it.each([
    [new SessionNotFoundError(), NotFoundException, 'SESSION_NOT_FOUND'],
    [new SessionFinishedError(), ConflictException, 'SESSION_FINISHED'],
    [new AnswerNotExpectedError(), ConflictException, 'ANSWER_NOT_EXPECTED'],
  ])(
    '[TC-04-02] maps the pre-check failure %s to %s and skips speech recognition',
    async (domain, type, code) => {
      const { service, speech, repository } = setupVoice({
        answerIndexFor: vi.fn().mockRejectedValue(domain),
      });

      const error = await rejection(
        service.submitAudio(USER_ID, SESSION_ID, AUDIO),
      );

      expect(error).toBeInstanceOf(type);
      expect((error as NotFoundException).getResponse()).toMatchObject({
        code,
      });
      expect(speech.transcribe).not.toHaveBeenCalled();
      expect(repository.submitAnswer).not.toHaveBeenCalled();
    },
  );

  it('[TC-04-13] rejects a signature mismatch with 415 AUDIO_UNSUPPORTED before speech recognition', async () => {
    const { service, speech } = setupVoice();

    const error = await rejection(
      service.submitAudio(USER_ID, SESSION_ID, {
        buffer: Buffer.from('not audio'),
        mimetype: 'audio/webm',
      }),
    );

    expect(error).toBeInstanceOf(UnsupportedMediaTypeException);
    expect(
      (error as UnsupportedMediaTypeException).getResponse(),
    ).toMatchObject({ code: ERROR_CODES.AUDIO_UNSUPPORTED });
    expect(speech.transcribe).not.toHaveBeenCalled();
  });

  it('[TC-04-08] maps an unavailable provider to 503 and writes nothing', async () => {
    const { service, repository, retention } = setupVoice({
      transcribe: vi
        .fn()
        .mockRejectedValue(new SpeechRecognitionUnavailableError()),
    });

    const error = await rejection(
      service.submitAudio(USER_ID, SESSION_ID, AUDIO),
    );

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      code: ERROR_CODES.SPEECH_RECOGNITION_UNAVAILABLE,
    });
    expect(repository.submitAnswer).not.toHaveBeenCalled();
    expect(retention.keep).not.toHaveBeenCalled();
  });

  it.each([
    ['empty texts', { verbatim: '', clean: '' }],
    ['whitespace-only texts', { verbatim: '  \n ', clean: ' ' }],
    ['an empty clean text', { verbatim: 'Um, uh', clean: '' }],
  ])(
    '[TC-04-02] answers 422 TRANSCRIPT_EMPTY for %s and stores nothing',
    async (_label, transcript) => {
      const { service, repository, retention } = setupVoice({
        transcribe: vi.fn().mockResolvedValue(transcript),
      });

      const error = await rejection(
        service.submitAudio(USER_ID, SESSION_ID, AUDIO),
      );

      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect(
        (error as UnprocessableEntityException).getResponse(),
      ).toMatchObject({ code: ERROR_CODES.TRANSCRIPT_EMPTY });
      expect(repository.submitAnswer).not.toHaveBeenCalled();
      expect(retention.keep).not.toHaveBeenCalled();
    },
  );

  it('[TC-04-02] trims the transcript texts before storing them', async () => {
    const { service, repository } = setupVoice({
      transcribe: vi
        .fn()
        .mockResolvedValue({ verbatim: ' Um, I go \n', clean: ' I go ' }),
    });

    await service.submitAudio(USER_ID, SESSION_ID, AUDIO);

    expect(repository.submitAnswer).toHaveBeenCalledWith(USER_ID, SESSION_ID, {
      verbatim: 'Um, I go',
      clean: 'I go',
    });
  });

  it('[TC-04-02] caps a long transcript at ANSWER_TEXT_MAX like a typed answer', async () => {
    const { service, repository } = setupVoice({
      transcribe: vi.fn().mockResolvedValue({
        verbatim: 'a'.repeat(ANSWER_TEXT_MAX + 50),
        clean: 'b'.repeat(ANSWER_TEXT_MAX + 1),
      }),
    });

    await service.submitAudio(USER_ID, SESSION_ID, AUDIO);

    expect(repository.submitAnswer).toHaveBeenCalledWith(USER_ID, SESSION_ID, {
      verbatim: 'a'.repeat(ANSWER_TEXT_MAX),
      clean: 'b'.repeat(ANSWER_TEXT_MAX),
    });
  });

  it('[TC-04-08] treats a malformed provider result as an unavailable service', async () => {
    const { service, repository } = setupVoice({
      transcribe: vi.fn().mockResolvedValue({ verbatim: 42 }),
    });

    const error = await rejection(
      service.submitAudio(USER_ID, SESSION_ID, AUDIO),
    );

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(repository.submitAnswer).not.toHaveBeenCalled();
  });

  it('[TC-04-02] keeps no dev copy when the answer is rejected under the lock', async () => {
    const { service, retention } = setupVoice({
      submitAnswer: vi.fn().mockRejectedValue(new AnswerNotExpectedError()),
    });

    const error = await rejection(
      service.submitAudio(USER_ID, SESSION_ID, AUDIO),
    );

    expect(error).toBeInstanceOf(ConflictException);
    expect(retention.keep).not.toHaveBeenCalled();
  });
});

describe('AnswersService.answer', () => {
  it('[TC-04-02] sends an uploaded file to speech recognition and ignores the body', async () => {
    const { service, speech, repository } = setupVoice();

    await service.answer(USER_ID, SESSION_ID, {
      audio: AUDIO,
      body: { text: 'ignored' },
    });

    expect(speech.transcribe).toHaveBeenCalledOnce();
    expect(repository.submitAnswer).toHaveBeenCalledWith(
      USER_ID,
      SESSION_ID,
      TRANSCRIPT,
    );
  });

  it('[TC-04-03] stores a text body as both verbatim and clean without speech recognition', async () => {
    const { service, speech, repository } = setupVoice();

    await service.answer(USER_ID, SESSION_ID, {
      audio: undefined,
      body: { text: 'I very like it' },
    });

    expect(speech.transcribe).not.toHaveBeenCalled();
    expect(repository.submitAnswer).toHaveBeenCalledWith(
      USER_ID,
      SESSION_ID,
      ANSWER,
    );
  });

  it('[TC-04-03] rejects a body without text before any lookup', async () => {
    const { service, repository } = setupVoice();

    await expect(
      service.answer(USER_ID, SESSION_ID, { audio: undefined, body: {} }),
    ).rejects.toThrow('Request validation failed');
    expect(repository.submitAnswer).not.toHaveBeenCalled();
  });
});
