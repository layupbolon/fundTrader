import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import Redis from 'ioredis';

function loadRootEnv() {
  const envPath = path.resolve(__dirname, '../../../.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = process.env[key] || value;
  }
}

async function checkEnv(name: string, minLength = 1) {
  const value = process.env[name];
  if (!value || value.length < minLength) {
    throw new Error(`${name} is required and must be at least ${minLength} chars`);
  }
}

async function checkDatabase() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'fundtrader',
  });
  try {
    await client.connect();
    await client.query('select 1');
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function checkRedis() {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
    lazyConnect: true,
    maxRetriesPerRequest: 0,
  });
  try {
    await redis.connect();
    await redis.ping();
  } finally {
    redis.disconnect();
  }
}

async function checkBackupDir() {
  const backupDir = process.env.BACKUP_DIR || path.resolve(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const probe = path.join(backupDir, `.preflight-${Date.now()}`);
  fs.writeFileSync(probe, 'ok');
  fs.unlinkSync(probe);
}

async function main() {
  loadRootEnv();
  await checkEnv('MASTER_KEY', 32);
  await checkEnv('JWT_SECRET', 32);
  await checkDatabase();
  await checkRedis();
  await checkBackupDir();
  process.stdout.write('Preflight check passed\n');
}

main().catch((error) => {
  process.stderr.write(
    `Preflight check failed: ${error instanceof Error ? error.message : error}\n`,
  );
  process.exit(1);
});
