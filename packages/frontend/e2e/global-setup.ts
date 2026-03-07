import { execSync } from 'child_process';
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

async function globalSetup() {
  const e2eEnv = loadEnvFile(path.resolve(__dirname, '../../../.env.e2e'));

  execSync('pnpm --filter @fundtrader/backend test:e2e:seed', {
    stdio: 'inherit',
    env: {
      ...e2eEnv,
      ...process.env,
      NODE_ENV: 'test',
      SCHEDULER_ENABLED: 'false',
      BROKER_MOCK: 'true',
      TELEGRAM_POLLING_ENABLED: 'false',
    },
  });
}

export default globalSetup;
