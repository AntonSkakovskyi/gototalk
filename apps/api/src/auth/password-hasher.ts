import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import type { Options } from '@node-rs/argon2';

// 2 = Algorithm.Argon2id; the ambient const enum cannot be imported under verbatimModuleSyntax.
const HASH_OPTIONS: Options = {
  algorithm: 2,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

@Injectable()
export class PasswordHasher {
  // Computed once at construction so verifyDummy costs the same as a real verify.
  private readonly dummyHash: Promise<string> = hash(
    randomUUID(),
    HASH_OPTIONS,
  );

  hash(password: string): Promise<string> {
    return hash(password, HASH_OPTIONS);
  }

  async verify(hashed: string, password: string): Promise<boolean> {
    try {
      return await verify(hashed, password);
    } catch {
      return false;
    }
  }

  async verifyDummy(password: string): Promise<false> {
    await this.verify(await this.dummyHash, password);
    return false;
  }
}
