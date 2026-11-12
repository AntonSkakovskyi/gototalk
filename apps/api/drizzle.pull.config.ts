import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'drizzle-kit';

// Конфіг лише для db:pull: інтроспекція БД у тимчасову теку (в .gitignore),
// звідки scripts/db-pull.mjs копіює schema.ts і relations.ts у src/db/.
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
