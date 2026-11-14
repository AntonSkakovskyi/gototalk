const SAMPLE_INTERVAL_MS = 100;
const FFT_SIZE = 256;

/** Reports the input level (0..1) of the stream until the returned teardown runs. */
export function startLevelMeter(
  stream: MediaStream,
  onLevel: (level: number) => void,
): () => void {
  if (typeof AudioContext === 'undefined') {
    return () => undefined;
  }
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  source.connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);

  const timer = setInterval(() => {
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) {
      const centered = (sample - 128) / 128;
      sum += centered * centered;
    }
    onLevel(Math.min(1, Math.sqrt(sum / samples.length)));
  }, SAMPLE_INTERVAL_MS);

  return () => {
    clearInterval(timer);
    source.disconnect();
    void context.close();
  };
}
