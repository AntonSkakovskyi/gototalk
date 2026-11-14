import { MAX_RECORDING_SECONDS } from '@gototalk/shared';
import { act } from '@testing-library/react';
import {
  FakeAudioContext,
  FakeMediaRecorder,
  FakeStream,
  installFakeMedia,
} from '@/features/dialogue/testing/fake-media';
import {
  allTracksStopped,
  renderRecorder,
  startRecording,
  tickSeconds,
} from '@/features/dialogue/testing/recorder-harness';

let media: ReturnType<typeof installFakeMedia>;

beforeEach(() => {
  vi.useFakeTimers();
  media = installFakeMedia();
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

describe('useAudioRecorder', () => {
  it('[TC-04-05] is idle when recording is supported', () => {
    const { result } = renderRecorder();

    expect(result.current).toMatchObject({
      status: 'idle',
      errorName: null,
      insecureContext: false,
      elapsedSeconds: 0,
      level: 0,
    });
  });

  it('[TC-04-05] requests the microphone and records with the preferred type', async () => {
    const { result } = renderRecorder();

    await startRecording(result);

    expect(media.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(result.current.status).toBe('recording');
    expect(FakeMediaRecorder.instances[0]!.mimeType).toBe(
      'audio/webm;codecs=opus',
    );
  });

  it('[TC-04-05] uses the first supported type from the fallback list', async () => {
    FakeMediaRecorder.supported = new Set(['audio/mp4']);
    const { result } = renderRecorder();

    await startRecording(result);

    expect(FakeMediaRecorder.instances[0]!.mimeType).toBe('audio/mp4');
  });

  it('[TC-04-05] stop delivers one blob with its type and stops all tracks', async () => {
    const { result, onRecorded } = renderRecorder();
    await startRecording(result);

    act(() => result.current.stop());

    expect(onRecorded).toHaveBeenCalledTimes(1);
    const audio = onRecorded.mock.calls[0]![0];
    expect(audio.type).toBe('audio/webm;codecs=opus');
    expect(audio.size).toBeGreaterThan(0);
    expect(result.current.status).toBe('idle');
    expect(allTracksStopped(media)).toBe(true);
    expect(FakeAudioContext.instances[0]!.closed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('[TC-04-05] counts elapsed seconds and resets on the next recording', async () => {
    const { result } = renderRecorder();
    await startRecording(result);

    await tickSeconds(3);
    expect(result.current.elapsedSeconds).toBe(3);

    act(() => result.current.stop());
    await startRecording(result);
    expect(result.current.elapsedSeconds).toBe(0);
  });

  it('[TC-04-05] stops automatically at the limit and still delivers the blob', async () => {
    const { result, onRecorded } = renderRecorder();
    await startRecording(result);

    await tickSeconds(MAX_RECORDING_SECONDS - 1);
    expect(result.current.status).toBe('recording');
    expect(onRecorded).not.toHaveBeenCalled();

    await tickSeconds(1);

    expect(onRecorded).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
    expect(allTracksStopped(media)).toBe(true);
  });

  it('[TC-04-05] enforces the limit even when the display tick never fires', async () => {
    const setIntervalSpy = vi
      .spyOn(globalThis, 'setInterval')
      .mockReturnValue(0 as unknown as ReturnType<typeof setInterval>);
    const { result, onRecorded } = renderRecorder();
    await startRecording(result);

    await tickSeconds(MAX_RECORDING_SECONDS);
    setIntervalSpy.mockRestore();

    expect(onRecorded).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
  });

  it('[TC-04-05] an automatic stop racing a manual stop delivers exactly one blob', async () => {
    FakeMediaRecorder.deferEvents = true;
    const { result, onRecorded } = renderRecorder();
    await startRecording(result);
    const recorder = FakeMediaRecorder.instances[0]!;

    act(() => result.current.stop());
    await tickSeconds(MAX_RECORDING_SECONDS);
    act(() => recorder.flush());

    expect(recorder.stopCalls).toBe(1);
    expect(onRecorded).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
  });

  it('[TC-04-05] ignores a second start while requesting or recording', async () => {
    const { result } = renderRecorder();

    await act(async () => {
      void result.current.start();
      void result.current.start();
    });
    await startRecording(result);

    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
    expect(FakeMediaRecorder.instances).toHaveLength(1);
  });

  it('[TC-04-05] stop without a recording does nothing', () => {
    const { result, onRecorded } = renderRecorder();

    act(() => result.current.stop());

    expect(onRecorded).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('[TC-04-05] unmounting while recording stops everything and delivers nothing', async () => {
    const { result, unmount, onRecorded } = renderRecorder();
    await startRecording(result);

    unmount();

    expect(FakeMediaRecorder.instances[0]!.state).toBe('inactive');
    expect(allTracksStopped(media)).toBe(true);
    expect(FakeAudioContext.instances[0]!.closed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it('[TC-04-05] a late stop event after unmount delivers nothing', async () => {
    FakeMediaRecorder.deferEvents = true;
    const { result, unmount, onRecorded } = renderRecorder();
    await startRecording(result);

    unmount();
    FakeMediaRecorder.instances[0]!.flush();

    expect(onRecorded).not.toHaveBeenCalled();
  });

  it('[TC-04-05] a late error event after unmount does nothing', async () => {
    FakeMediaRecorder.deferEvents = true;
    const { result, unmount, onRecorded } = renderRecorder();
    await startRecording(result);
    const recorder = FakeMediaRecorder.instances[0]!;

    unmount();
    recorder.fail();
    recorder.flush();

    expect(onRecorded).not.toHaveBeenCalled();
    expect(allTracksStopped(media)).toBe(true);
  });

  it('[TC-04-05] unmounting while the permission prompt is open releases the stream', async () => {
    let grant: (stream: unknown) => void = () => undefined;
    media.getUserMedia.mockReturnValueOnce(
      new Promise((resolve) => {
        grant = resolve;
      }),
    );
    const { result, unmount } = renderRecorder();
    act(() => void result.current.start());
    const stream = new FakeStream();

    unmount();
    await act(async () => grant(stream));

    expect(stream.tracks.every((track) => track.stopped)).toBe(true);
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });
});
