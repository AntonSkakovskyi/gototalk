import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit does not read .env itself, and the only .env lives in the repo root.
const envPath = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

// Migrations are hand-written SQL (drizzle-kit generate --custom); the TS schema is not the source of truth.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: '../../db/migrations',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? '',
  },
});
