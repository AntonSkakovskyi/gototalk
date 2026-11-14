import { useCallback, useEffect, useRef, useState } from 'react';
import {
  beginRecording,
  type RecordingSession,
} from '@/features/dialogue/lib/recording-session';
import { pickRecorderMime } from '@/features/dialogue/lib/recorder-mime';

export type RecorderStatus =
  'idle' | 'requesting' | 'recording' | 'denied' | 'unsupported' | 'error';

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

export function useAudioRecorder({ onRecorded }: Options) {
  const [status, setStatus] = useState<RecorderStatus>(() =>
    supportedMime() ? 'idle' : 'unsupported',
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const sessionRef = useRef<RecordingSession | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sessionRef.current?.cancel();
      sessionRef.current = null;
    };
  }, []);

  const start = useCallback(async () => {
    const mime = supportedMime();
    if (busyRef.current || !mime) return;
    busyRef.current = true;
    setStatus('requesting');
    const finish = (next: RecorderStatus) => {
      busyRef.current = false;
      sessionRef.current = null;
      setLevel(0);
      setStatus(next);
    };

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const denied =
        error instanceof DOMException && DENIED_ERRORS.has(error.name);
      busyRef.current = false;
      if (mountedRef.current) setStatus(denied ? 'denied' : 'error');
      return;
    }
    if (!mountedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    try {
      setElapsedSeconds(0);
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
    } catch {
      finish('error');
    }
  }, []);

  const stop = useCallback(() => sessionRef.current?.stop(), []);

  return { status, elapsedSeconds, level, start, stop };
}
