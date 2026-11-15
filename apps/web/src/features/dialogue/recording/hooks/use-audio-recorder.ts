import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  beginRecording,
  stopTracks,
  type RecordingSession,
} from '@/features/dialogue/recording/lib/recording-session';
import { pickRecorderMime } from '@/features/dialogue/recording/lib/recorder-mime';
import type { RecorderStatus } from '@/features/dialogue/recording/lib/recorder-status';

interface Options {
  /** Called once per finished recording, also after the automatic stop; never after unmount. */
  onRecorded: (audio: Blob) => void;
}

const DENIED_ERRORS = new Set(['NotAllowedError', 'SecurityError']);

function supportedMime(): string | null {
  if (
    typeof MediaRecorder === 'undefined' ||
    typeof navigator.mediaDevices?.getUserMedia !== 'function'
  ) {
    return null;
  }
  return pickRecorderMime((mime) => MediaRecorder.isTypeSupported(mime));
}

function errorNameOf(error: unknown): string | null {
  return typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    typeof error.name === 'string'
    ? error.name
    : null;
}

export function useAudioRecorder({ onRecorded }: Options) {
  const [status, setStatus] = useState<RecorderStatus>(() =>
    supportedMime() ? 'idle' : 'unsupported',
  );
  const [errorName, setErrorName] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const sessionRef = useRef<RecordingSession | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const onRecordedRef = useRef(onRecorded);

  useLayoutEffect(() => {
    onRecordedRef.current = onRecorded;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sessionRef.current?.cancel();
      sessionRef.current = null;
    };
  }, []);

  const finish = useCallback((next: RecorderStatus, cause: unknown = null) => {
    busyRef.current = false;
    sessionRef.current = null;
    setLevel(0);
    setErrorName(errorNameOf(cause));
    setStatus(next);
  }, []);

  const launch = useCallback(
    (stream: MediaStream, mime: string) => {
      setElapsedSeconds(0);
      try {
        sessionRef.current = beginRecording(stream, mime, {
          onElapsed: setElapsedSeconds,
          onLevel: setLevel,
          onDone: (audio) => {
            finish('idle');
            onRecordedRef.current(audio);
          },
          onFailed: () => finish('error'),
        });
        setStatus('recording');
      } catch (error) {
        finish('error', error);
      }
    },
    [finish],
  );

  const start = useCallback(async () => {
    const mime = supportedMime();
    if (busyRef.current || !mime) return;
    busyRef.current = true;
    setErrorName(null);
    setStatus('requesting');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const name = errorNameOf(error);
      const denied = name !== null && DENIED_ERRORS.has(name);
      finish(denied ? 'denied' : 'error', error);
      return;
    }
    if (!mountedRef.current) {
      busyRef.current = false;
      stopTracks(stream);
      return;
    }
    launch(stream, mime);
  }, [finish, launch]);

  const stop = useCallback(() => sessionRef.current?.stop(), []);

  const insecureContext =
    status === 'unsupported' && window.isSecureContext === false;

  return {
    status,
    errorName,
    insecureContext,
    elapsedSeconds,
    level,
    start,
    stop,
  };
}
