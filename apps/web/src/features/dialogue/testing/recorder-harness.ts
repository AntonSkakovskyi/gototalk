import { vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { installFakeMedia } from '@/features/dialogue/testing/fake-media';
import { useAudioRecorder } from '@/features/dialogue/hooks/use-audio-recorder';

export function renderRecorder() {
  const onRecorded = vi.fn<(audio: Blob) => void>();
  const hook = renderHook(() => useAudioRecorder({ onRecorded }));
  return { ...hook, onRecorded };
}

export async function startRecording(
  result: ReturnType<typeof renderRecorder>['result'],
): Promise<void> {
  await act(async () => {
    await result.current.start();
  });
}

export function tickSeconds(seconds: number) {
  return act(() => vi.advanceTimersByTimeAsync(seconds * 1000));
}

export function rejectMicrophone(
  media: ReturnType<typeof installFakeMedia>,
  name: string,
) {
  media.getUserMedia.mockRejectedValueOnce(new DOMException('x', name));
}

export function allTracksStopped(
  media: ReturnType<typeof installFakeMedia>,
  index = 0,
): boolean {
  return media.streams[index]!.tracks.every((track) => track.stopped);
}
