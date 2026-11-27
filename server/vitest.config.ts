import 'dotenv/config';
import { defineConfig } from 'vitest/config';

// Тесты работают с отдельной базой traintix_test (создаётся заново перед каждым запуском)
const url = new URL(process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/traintix');
url.pathname = '/traintix_test';

export default defineConfig({
  test: {
    env: { DATABASE_URL: url.toString(), NODE_ENV: 'test', EMAIL_WORKER: 'off', LOG_LEVEL: 'silent' },
    globalSetup: './tests/globalSetup.ts',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
