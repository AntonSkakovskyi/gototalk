export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

export const MAX_RECORDING_SECONDS = 120;

export const AUDIO_MIME_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
] as const;

export type AudioMimeType = (typeof AUDIO_MIME_TYPES)[number];
