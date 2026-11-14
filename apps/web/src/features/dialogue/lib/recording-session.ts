import { MAX_RECORDING_SECONDS } from '@gototalk/shared';
import { startLevelMeter } from './audio-level';

export interface RecordingCallbacks {
  onElapsed: (seconds: number) => void;
  onLevel: (level: number) => void;
  onDone: (audio: Blob) => void;
  onFailed: () => void;
}

export interface RecordingSession {
  stop: () => void;
  /** Discards the recording: stops everything and calls no callbacks. */
  cancel: () => void;
}

const TICK_MS = 1000;

/** Takes ownership of the stream: every track is stopped on any outcome, including a throw. */
export function beginRecording(
  stream: MediaStream,
  mime: string,
  callbacks: RecordingCallbacks,
): RecordingSession {
  let settled = false;
  let release = () => stream.getTracks().forEach((track) => track.stop());
  try {
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    const stopMeter = startLevelMeter(stream, callbacks.onLevel);
    const tick = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / TICK_MS);
      callbacks.onElapsed(Math.min(seconds, MAX_RECORDING_SECONDS));
      if (seconds >= MAX_RECORDING_SECONDS && recorder.state === 'recording') {
        recorder.stop();
      }
    }, TICK_MS);
    release = () => {
      clearInterval(tick);
      stopMeter();
      stream.getTracks().forEach((track) => track.stop());
    };

    const settle = (notify?: () => void) => {
      if (settled) return;
      settled = true;
      release();
      notify?.();
    };
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    recorder.addEventListener('error', () => settle(callbacks.onFailed));
    recorder.addEventListener('stop', () => {
      const audio = new Blob(chunks, { type: recorder.mimeType || mime });
      settle(() =>
        audio.size > 0 ? callbacks.onDone(audio) : callbacks.onFailed(),
      );
    });
    recorder.start();

    return {
      stop: () => {
        if (recorder.state === 'recording') recorder.stop();
      },
      cancel: () => {
        settle();
        if (recorder.state !== 'inactive') recorder.stop();
      },
    };
  } catch (error) {
    settled = true;
    release();
    throw error;
  }
}
