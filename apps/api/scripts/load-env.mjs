import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Лише для CLI-скриптів міграцій (виняток із правила «.env читає тільки конфіг-модуль»; у рантаймі API конфіг із задачі 00-07).
// Єдиний .env у корені репозиторію. Уже задані змінні середовища (CI, ручне перевизначення) він не перезаписує.
const envPath = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(
      `Змінна ${name} не задана. Скопіюйте .env.example у .env і заповніть її.`,
    );
    process.exit(1);
  }
  return value;
}
