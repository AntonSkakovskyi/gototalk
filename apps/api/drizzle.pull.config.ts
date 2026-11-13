import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'drizzle-kit';

// Introspects into a git-ignored temp dir; scripts/db-pull.mjs copies the result into src/core/db/.
const envPath = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

export default defineConfig({
  dialect: 'postgresql',
  out: './.drizzle-pull',
  schemaFilter: ['public'],
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? '',
  },
});
