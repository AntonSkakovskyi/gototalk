import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Only CLI scripts read .env here; variables already set (CI, manual override) are not overwritten.
const envPath = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(
      `Environment variable ${name} is not set. Copy .env.example to .env and fill it in.`,
    );
    process.exit(1);
  }
  return value;
}
