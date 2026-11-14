import { MAX_RECORDING_SECONDS } from '@gototalk/shared';
import { act, renderHook } from '@testing-library/react';
import {
  FakeAnalyser,
  FakeAudioContext,
  FakeMediaRecorder,
  FakeStream,
  installFakeMedia,
  removeMediaDevices,
} from '@/features/dialogue/testing/fake-media';
import { useAudioRecorder } from './use-audio-recorder';

let media: ReturnType<typeof installFakeMedia>;

beforeEach(() => {
  vi.useFakeTimers();
  media = installFakeMedia();
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

function setup() {
  const onRecorded = vi.fn<(audio: Blob) => void>();
  const hook = renderHook(() => useAudioRecorder({ onRecorded }));
  return { ...hook, onRecorded };
}

async function startRecording(
  result: ReturnType<typeof setup>['result'],
): Promise<void> {
  await act(async () => {
    await result.current.start();
  });
}

function tickSeconds(seconds: number) {
  return act(() => vi.advanceTimersByTimeAsync(seconds * 1000));
}

function rejectMicrophone(name: string) {
  media.getUserMedia.mockRejectedValueOnce(new DOMException('x', name));
}

function allTracksStopped(index = 0): boolean {
  return media.streams[index]!.tracks.every((track) => track.stopped);
}

describe('useAudioRecorder', () => {
  it('[TC-04-05] is idle when recording is supported', () => {
    const { result } = setup();

    expect(result.current).toMatchObject({
      status: 'idle',
      elapsedSeconds: 0,
      level: 0,
    });
  });

  it('[TC-04-05] requests the microphone and records with the preferred type', async () => {
    const { result } = setup();

    await startRecording(result);

    expect(media.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(result.current.status).toBe('recording');
    expect(FakeMediaRecorder.instances[0]!.mimeType).toBe(
      'audio/webm;codecs=opus',
    );
  });

  it('[TC-04-05] uses the first supported type from the fallback list', async () => {
    FakeMediaRecorder.supported = new Set(['audio/mp4']);
    const { result } = setup();

    await startRecording(result);

    expect(FakeMediaRecorder.instances[0]!.mimeType).toBe('audio/mp4');
  });

  it('[TC-04-05] stop delivers one blob with its type and stops all tracks', async () => {
    const { result, onRecorded } = setup();
    await startRecording(result);

    act(() => result.current.stop());

    expect(onRecorded).toHaveBeenCalledTimes(1);
    const audio = onRecorded.mock.calls[0]![0];
    expect(audio.type).toBe('audio/webm;codecs=opus');
    expect(audio.size).toBeGreaterThan(0);
    expect(result.current.status).toBe('idle');
    expect(allTracksStopped()).toBe(true);
    expect(FakeAudioContext.instances[0]!.closed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('[TC-04-05] counts elapsed seconds and resets on the next recording', async () => {
    const { result } = setup();
    await startRecording(result);

    await tickSeconds(3);
    expect(result.current.elapsedSeconds).toBe(3);

    act(() => result.current.stop());
    await startRecording(result);
    expect(result.current.elapsedSeconds).toBe(0);
  });

  it('[TC-04-05] stops automatically at the limit and still delivers the blob', async () => {
    const { result, onRecorded } = setup();
    await startRecording(result);

    await tickSeconds(MAX_RECORDING_SECONDS - 1);
    expect(result.current.status).toBe('recording');
    expect(onRecorded).not.toHaveBeenCalled();

    await tickSeconds(1);

    expect(onRecorded).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
    expect(allTracksStopped()).toBe(true);
  });

  it('[TC-04-05] reports the input level from the analyser and resets it after stop', async () => {
    const { result } = setup();
    await startRecording(result);

    FakeAnalyser.amplitude = 1;
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(result.current.level).toBeGreaterThan(0);
    expect(result.current.level).toBeLessThanOrEqual(1);

    act(() => result.current.stop());
    expect(result.current.level).toBe(0);
  });

  it('[TC-04-05] reports zero level for silence', async () => {
    const { result } = setup();
    await startRecording(result);

    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(result.current.level).toBe(0);
  });

  it('[TC-04-05] still records when AudioContext is missing', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const { result, onRecorded } = setup();

    await startRecording(result);
    act(() => result.current.stop());

    expect(onRecorded).toHaveBeenCalledTimes(1);
  });

  it('[TC-04-05] ignores a second start while requesting or recording', async () => {
    const { result } = setup();

    await act(async () => {
      void result.current.start();
      void result.current.start();
    });
    await startRecording(result);

    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
    expect(FakeMediaRecorder.instances).toHaveLength(1);
  });

  it('[TC-04-05] stop without a recording does nothing', () => {
    const { result, onRecorded } = setup();

    act(() => result.current.stop());

    expect(onRecorded).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('[TC-04-05] unmounting while recording stops everything and delivers nothing', async () => {
    const { result, unmount, onRecorded } = setup();
    await startRecording(result);

    unmount();

    expect(FakeMediaRecorder.instances[0]!.state).toBe('inactive');
    expect(allTracksStopped()).toBe(true);
    expect(FakeAudioContext.instances[0]!.closed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it('[TC-04-05] unmounting while the permission prompt is open releases the stream', async () => {
    let grant: (stream: unknown) => void = () => undefined;
    media.getUserMedia.mockReturnValueOnce(
      new Promise((resolve) => {
        grant = resolve;
      }),
    );
    const { result, unmount } = setup();
    act(() => void result.current.start());
    const stream = new FakeStream();

    unmount();
    await act(async () => grant(stream));

    expect(stream.tracks.every((track) => track.stopped)).toBe(true);
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });

  it.each(['NotAllowedError', 'SecurityError'])(
    '[TC-04-05] maps %s to denied and allows another try',
    async (name) => {
      rejectMicrophone(name);
      const { result } = setup();

      await startRecording(result);
      expect(result.current.status).toBe('denied');

      await startRecording(result);
      expect(result.current.status).toBe('recording');
    },
  );

  it('[TC-04-05] maps a missing microphone to error', async () => {
    rejectMicrophone('NotFoundError');
    const { result } = setup();

    await startRecording(result);

    expect(result.current.status).toBe('error');
  });

  it('[TC-04-05] a recorder error ends in error, stops tracks and delivers nothing', async () => {
    const { result, onRecorded } = setup();
    await startRecording(result);

    act(() => FakeMediaRecorder.instances[0]!.fail());

    expect(result.current.status).toBe('error');
    expect(allTracksStopped()).toBe(true);
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it('[TC-04-05] a recording without data ends in error', async () => {
    const { result, onRecorded } = setup();
    await startRecording(result);
    FakeMediaRecorder.instances[0]!.emitData = false;

    act(() => result.current.stop());

    expect(result.current.status).toBe('error');
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it('[TC-04-05] a recorder that cannot be created ends in error and releases the stream', async () => {
    FakeMediaRecorder.failOnConstruct = true;
    const { result } = setup();

    await startRecording(result);

    expect(result.current.status).toBe('error');
    expect(allTracksStopped()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('[TC-04-05] is unsupported without MediaRecorder', async () => {
    vi.stubGlobal('MediaRecorder', undefined);
    const { result } = setup();

    expect(result.current.status).toBe('unsupported');
    await startRecording(result);
    expect(media.getUserMedia).not.toHaveBeenCalled();
  });

  it('[TC-04-05] is unsupported without mediaDevices', () => {
    removeMediaDevices();

    const { result } = setup();

    expect(result.current.status).toBe('unsupported');
  });

  it('[TC-04-05] is unsupported when no audio type is supported and never asks for the microphone', async () => {
    FakeMediaRecorder.supported = new Set();
    const { result } = setup();

    expect(result.current.status).toBe('unsupported');
    await startRecording(result);
    expect(media.getUserMedia).not.toHaveBeenCalled();
  });
});
