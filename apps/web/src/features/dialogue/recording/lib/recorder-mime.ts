import { AUDIO_MIME_TYPES, type AudioMimeType } from '@gototalk/shared';

const RECORDER_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/mp4',
] as const;

const EXTENSIONS: Record<AudioMimeType, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
};

export function pickRecorderMime(
  isTypeSupported: (mime: string) => boolean,
): string | null {
  return RECORDER_MIME_CANDIDATES.find((mime) => isTypeSupported(mime)) ?? null;
}

export function baseMimeType(mime: string): string {
  return (mime.split(';')[0] ?? '').trim().toLowerCase();
}

export function audioFileName(mime: string): string {
  const base = AUDIO_MIME_TYPES.find((type) => type === baseMimeType(mime));
  return `answer.${base ? EXTENSIONS[base] : 'webm'}`;
}
