const SAMPLE_INTERVAL_MS = 100;
const FFT_SIZE = 256;
const noop = () => undefined;

function rms(samples: Uint8Array): number {
  let sum = 0;
  for (const sample of samples) {
    const centered = (sample - 128) / 128;
    sum += centered * centered;
  }
  return Math.min(1, Math.sqrt(sum / samples.length));
}

/** Input level as RMS 0..1; the meter is cosmetic, so a setup failure yields a no-op teardown. */
export function startLevelMeter(
  stream: MediaStream,
  onLevel: (level: number) => void,
): () => void {
  if (typeof AudioContext === 'undefined') return noop;
  let context: AudioContext | undefined;
  try {
    context = new AudioContext();
    const owned = context;
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    // Safari creates contexts suspended until resumed
    if (context.state === 'suspended') context.resume().catch(noop);

    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(samples);
      onLevel(rms(samples));
    }, SAMPLE_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      source.disconnect();
      owned.close().catch(noop);
    };
  } catch {
    context?.close().catch(noop);
    return noop;
  }
}
