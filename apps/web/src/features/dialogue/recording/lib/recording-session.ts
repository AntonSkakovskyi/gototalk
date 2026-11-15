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

export function stopTracks(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop());
}

function stopIfRecording(recorder: MediaRecorder) {
  if (recorder.state === 'recording') recorder.stop();
}

// The interval only drives the display; a dedicated timeout enforces the limit even if ticks are delayed
function startTimers(
  recorder: MediaRecorder,
  onElapsed: (seconds: number) => void,
): () => void {
  const startedAt = Date.now();
  const tick = setInterval(() => {
    const seconds = Math.floor((Date.now() - startedAt) / TICK_MS);
    onElapsed(Math.min(seconds, MAX_RECORDING_SECONDS));
  }, TICK_MS);
  const limit = setTimeout(
    () => stopIfRecording(recorder),
    MAX_RECORDING_SECONDS * 1000,
  );
  return () => {
    clearInterval(tick);
    clearTimeout(limit);
  };
}

function listenToRecorder(
  recorder: MediaRecorder,
  mime: string,
  settle: (notify: () => void) => void,
  callbacks: RecordingCallbacks,
) {
  const chunks: Blob[] = [];
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
}

/** Takes ownership of the stream: every track is stopped on any outcome, including a throw. */
export function beginRecording(
  stream: MediaStream,
  mime: string,
  callbacks: RecordingCallbacks,
): RecordingSession {
  let settled = false;
  let release = () => stopTracks(stream);
  const settle = (notify?: () => void) => {
    if (settled) return;
    settled = true;
    release();
    notify?.();
  };
  try {
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const stopMeter = startLevelMeter(stream, callbacks.onLevel);
    const stopTimers = startTimers(recorder, callbacks.onElapsed);
    release = () => {
      stopTimers();
      stopMeter();
      stopTracks(stream);
    };
    listenToRecorder(recorder, mime, settle, callbacks);
    recorder.start();

    return {
      stop: () => stopIfRecording(recorder),
      cancel: () => {
        settle();
        if (recorder.state !== 'inactive') recorder.stop();
      },
    };
  } catch (error) {
    settle();
    throw error;
  }
}
