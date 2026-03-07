import { defineConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const result: Record<string, string> = {};
  const content = fs.readFileSync(filePath, 'utf8');

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    result[key] = value;
  }

  return result;
}

const rootEnv = loadEnvFile(path.resolve(__dirname, '../../.env.e2e'));
const mergedEnv = { ...rootEnv, ...process.env };

const backendEnv = {
  ...mergedEnv,
  NODE_ENV: 'test',
  PORT: mergedEnv.PORT || '3000',
  DB_HOST: mergedEnv.DB_HOST || 'localhost',
  DB_PORT: mergedEnv.DB_PORT || '5432',
  DB_USERNAME: mergedEnv.DB_USERNAME || 'postgres',
  DB_PASSWORD: mergedEnv.DB_PASSWORD || 'postgres',
  DB_DATABASE: mergedEnv.DB_DATABASE || 'fundtrader',
  REDIS_HOST: mergedEnv.REDIS_HOST || 'localhost',
  REDIS_PORT: mergedEnv.REDIS_PORT || '6379',
  JWT_SECRET: mergedEnv.JWT_SECRET || 'e2e_jwt_secret_at_least_32_characters',
  MASTER_KEY: mergedEnv.MASTER_KEY || 'e2e_master_key_at_least_32_characters_long',
  ENCRYPTION_SALT: mergedEnv.ENCRYPTION_SALT || 'e2e_salt_at_least_16_chars',
  SCHEDULER_ENABLED: 'false',
  BROKER_MOCK: 'true',
  TELEGRAM_POLLING_ENABLED: 'false',
};

const frontendEnv = {
  ...mergedEnv,
  VITE_API_PROXY_TARGET: mergedEnv.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: [
    {
      command: 'pnpm --filter @fundtrader/backend start',
      url: 'http://127.0.0.1:3000/api/health',
      env: backendEnv,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter @fundtrader/frontend dev',
      url: 'http://127.0.0.1:3001/login',
      env: frontendEnv,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
