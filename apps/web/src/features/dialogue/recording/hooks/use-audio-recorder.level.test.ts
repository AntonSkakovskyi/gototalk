import { act } from '@testing-library/react';
import {
  FakeAnalyser,
  FakeAudioContext,
  installFakeMedia,
} from '@/features/dialogue/recording/testing/fake-media';
import {
  renderRecorder,
  startRecording,
} from '@/features/dialogue/recording/testing/recorder-harness';

beforeEach(() => {
  vi.useFakeTimers();
  installFakeMedia();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

describe('useAudioRecorder level meter', () => {
  it('[TC-04-05] reports the input level from the analyser and resets it after stop', async () => {
    const { result } = renderRecorder();
    await startRecording(result);

    FakeAnalyser.amplitude = 1;
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(result.current.level).toBeGreaterThan(0);
    expect(result.current.level).toBeLessThanOrEqual(1);

    act(() => result.current.stop());
    expect(result.current.level).toBe(0);
  });

  it('[TC-04-05] reports zero level for silence', async () => {
    const { result } = renderRecorder();
    await startRecording(result);

    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(result.current.level).toBe(0);
  });

  it('[TC-04-05] still records when AudioContext is missing', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const { result, onRecorded } = renderRecorder();

    await startRecording(result);
    act(() => result.current.stop());

    expect(onRecorded).toHaveBeenCalledTimes(1);
  });

  it('[TC-04-05] still records and closes the context when the level meter setup throws', async () => {
    FakeAudioContext.failOnSetup = true;
    const { result, onRecorded } = renderRecorder();

    await startRecording(result);
    expect(result.current.status).toBe('recording');
    act(() => result.current.stop());

    expect(FakeAudioContext.instances[0]!.closed).toBe(true);
    expect(onRecorded).toHaveBeenCalledTimes(1);
  });

  it('[TC-04-05] resumes a suspended audio context', async () => {
    FakeAudioContext.initialState = 'suspended';
    const { result } = renderRecorder();

    await startRecording(result);

    expect(FakeAudioContext.instances[0]!.resumed).toBe(true);
  });
});
