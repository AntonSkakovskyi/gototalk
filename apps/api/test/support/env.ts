const PINNED_KEYS = [
  'FAKE_STT_FAIL',
  'FAKE_LLM_FAIL',
  'DEV_KEEP_AUDIO',
  'DEV_AUDIO_DIR',
] as const;

/** Clears the keys that change voice behavior from process.env (ConfigService falls back to it) and returns a function that puts process.env back as it was. */
export function isolateEnv(): () => void {
  const original = { ...process.env };
  for (const key of PINNED_KEYS) delete process.env[key];
  return () => {
    for (const key of Object.keys(process.env)) {
      if (!(key in original)) delete process.env[key];
    }
    for (const [key, value] of Object.entries(original)) {
      if (value !== undefined) process.env[key] = value;
    }
  };
}
