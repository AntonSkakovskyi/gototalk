import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AudioMimeType } from '@gototalk/shared';
import type { Env } from '../../core/config/env.schema.js';

const EXTENSIONS: Record<AudioMimeType, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
};

/** Development-only copy of received audio; does nothing unless DEV_KEEP_AUDIO=true. */
@Injectable()
export class AudioRetention {
  private readonly logger = new Logger(AudioRetention.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async keep(
    utteranceId: string,
    mime: AudioMimeType,
    audio: Buffer,
  ): Promise<void> {
    const dir = this.config.get('DEV_AUDIO_DIR', { infer: true });
    if (!this.config.get('DEV_KEEP_AUDIO', { infer: true }) || !dir) return;
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(
        path.join(dir, `${utteranceId}.${EXTENSIONS[mime]}`),
        audio,
      );
    } catch {
      this.logger.warn('Could not write the development audio copy');
    }
  }
}
