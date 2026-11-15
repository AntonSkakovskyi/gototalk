import { act } from '@testing-library/react';
import {
  FakeAudioContext,
  FakeMediaRecorder,
  installFakeMedia,
  removeMediaDevices,
} from '@/features/dialogue/recording/testing/fake-media';
import {
  allTracksStopped,
  rejectMicrophone,
  renderRecorder,
  startRecording,
} from '@/features/dialogue/recording/testing/recorder-harness';

let media: ReturnType<typeof installFakeMedia>;

beforeEach(() => {
  vi.useFakeTimers();
  media = installFakeMedia();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

describe('useAudioRecorder permission and failures', () => {
  it.each(['NotAllowedError', 'SecurityError'])(
    '[TC-04-05] maps %s to denied, keeps the cause and allows another try',
    async (name) => {
      rejectMicrophone(media, name);
      const { result } = renderRecorder();

      await startRecording(result);
      expect(result.current.status).toBe('denied');
      expect(result.current.errorName).toBe(name);

      await startRecording(result);
      expect(result.current.status).toBe('recording');
      expect(result.current.errorName).toBeNull();
    },
  );

  it.each(['NotFoundError', 'NotReadableError'])(
    '[TC-04-05] maps %s to error and keeps the cause',
    async (name) => {
      rejectMicrophone(media, name);
      const { result } = renderRecorder();

      await startRecording(result);

      expect(result.current.status).toBe('error');
      expect(result.current.errorName).toBe(name);
    },
  );

  it('[TC-04-05] a recorder error ends in error, stops tracks and delivers nothing', async () => {
    const { result, onRecorded } = renderRecorder();
    await startRecording(result);

    act(() => FakeMediaRecorder.instances[0]!.fail());

    expect(result.current.status).toBe('error');
    expect(allTracksStopped(media)).toBe(true);
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it('[TC-04-05] a recording without data ends in error', async () => {
    const { result, onRecorded } = renderRecorder();
    await startRecording(result);
    FakeMediaRecorder.instances[0]!.emitData = false;

    act(() => result.current.stop());

    expect(result.current.status).toBe('error');
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it('[TC-04-05] a recorder that cannot be created ends in error and releases the stream', async () => {
    FakeMediaRecorder.failOnConstruct = true;
    const { result } = renderRecorder();

    await startRecording(result);

    expect(result.current.status).toBe('error');
    expect(result.current.errorName).toBe('NotSupportedError');
    expect(allTracksStopped(media)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('[TC-04-05] a recorder that fails to start ends in error and releases everything', async () => {
    FakeMediaRecorder.failOnStart = true;
    const { result } = renderRecorder();

    await startRecording(result);

    expect(result.current.status).toBe('error');
    expect(result.current.errorName).toBe('InvalidStateError');
    expect(allTracksStopped(media)).toBe(true);
    expect(FakeAudioContext.instances[0]!.closed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('useAudioRecorder unsupported browsers', () => {
  it('[TC-04-05] is unsupported without MediaRecorder', async () => {
    vi.stubGlobal('MediaRecorder', undefined);
    const { result } = renderRecorder();

    expect(result.current.status).toBe('unsupported');
    await startRecording(result);
    expect(media.getUserMedia).not.toHaveBeenCalled();
  });

  it('[TC-04-05] is unsupported without mediaDevices', () => {
    removeMediaDevices();

    const { result } = renderRecorder();

    expect(result.current.status).toBe('unsupported');
    expect(result.current.insecureContext).toBe(false);
  });

  it('[TC-04-05] flags an insecure context as the reason for missing mediaDevices', () => {
    vi.stubGlobal('isSecureContext', false);
    removeMediaDevices();

    const { result } = renderRecorder();

    expect(result.current.status).toBe('unsupported');
    expect(result.current.insecureContext).toBe(true);
  });

  it('[TC-04-05] is unsupported when no audio type is supported and never asks for the microphone', async () => {
    FakeMediaRecorder.supported = new Set();
    const { result } = renderRecorder();

    expect(result.current.status).toBe('unsupported');
    await startRecording(result);
    expect(media.getUserMedia).not.toHaveBeenCalled();
  });
});
