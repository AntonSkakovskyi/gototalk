import fs from 'node:fs';
import { vi } from 'vitest';

const isStdStream = (fd: unknown) => fd === 1 || fd === 2;

/** Records what is written to stdout and stderr, including pino's direct fd writes, and keeps it out of the test output. */
export function captureLogs() {
  const lines: string[] = [];
  const record = (data: unknown) => {
    lines.push(Buffer.isBuffer(data) ? data.toString('latin1') : String(data));
  };
  const writeSync = fs.writeSync;
  const write = fs.write;
  const spies = [
    vi.spyOn(process.stdout, 'write').mockImplementation((data: unknown) => {
      record(data);
      return true;
    }),
    vi.spyOn(process.stderr, 'write').mockImplementation((data: unknown) => {
      record(data);
      return true;
    }),
    vi.spyOn(fs, 'writeSync').mockImplementation(((
      fd: number,
      ...args: unknown[]
    ) => {
      if (!isStdStream(fd)) return Reflect.apply(writeSync, fs, [fd, ...args]);
      record(args[0]);
      return Buffer.byteLength(args[0] as string);
    }) as typeof fs.writeSync),
    vi.spyOn(fs, 'write').mockImplementation(((
      fd: number,
      ...args: unknown[]
    ) => {
      if (!isStdStream(fd)) return Reflect.apply(write, fs, [fd, ...args]);
      record(args[0]);
      const callback = args.find((arg) => typeof arg === 'function') as
        ((error: null, written: number) => void) | undefined;
      callback?.(null, Buffer.byteLength(args[0] as string));
    }) as typeof fs.write),
  ];
  return {
    text: () => lines.join(''),
    restore: () => spies.forEach((spy) => spy.mockRestore()),
  };
}
