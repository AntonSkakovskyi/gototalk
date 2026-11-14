import { AUDIO_MIME_TYPES, type AudioMimeType } from '@gototalk/shared';

const SIGNATURES: Record<AudioMimeType, { offset: number; bytes: Buffer }> = {
  'audio/webm': { offset: 0, bytes: Buffer.from([0x1a, 0x45, 0xdf, 0xa3]) },
  'audio/ogg': { offset: 0, bytes: Buffer.from('OggS', 'latin1') },
  'audio/mp4': { offset: 4, bytes: Buffer.from('ftyp', 'latin1') },
};

/** Returns the base MIME type when it is whitelisted and the file signature matches, otherwise null. */
export function detectAudioFormat(
  declaredMime: string,
  bytes: Buffer,
): AudioMimeType | null {
  const base = declaredMime.split(';')[0]?.trim().toLowerCase();
  const mime = AUDIO_MIME_TYPES.find((type) => type === base);
  if (!mime) {
    return null;
  }
  const { offset, bytes: signature } = SIGNATURES[mime];
  const actual = bytes.subarray(offset, offset + signature.length);
  return actual.equals(signature) ? mime : null;
}
