import * as fs from 'fs';
import * as path from 'path';

type QueryResult<T> = {
  rows: T[];
  rowCount: number | null;
};

type PgClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
};

const { Client } = require('pg') as {
  Client: new (config: Record<string, unknown>) => PgClient;
};

const ROOT_DIR = path.resolve(__dirname, '../../..');
const ENV_PATH = path.join(ROOT_DIR, '.env');

function print(message: string) {
  process.stdout.write(`${message}\n`);
}

function formatError(error: unknown) {
  if (error instanceof AggregateError) {
    const details = error.errors
      .map((item) => formatError(item))
      .filter(Boolean)
      .join('; ');

    return details || error.message || 'Unknown aggregate error';
  }

  if (error instanceof Error) {
    const code = 'code' in error ? ` ${(error as Error & { code?: string }).code}` : '';
    return `${error.message || error.name}${code}`.trim();
  }

  return String(error);
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = unquote(rawValue.trim());
  }
}

function unquote(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function getRequiredEnv(primary: string, fallback?: string) {
  const value = process.env[primary] || (fallback ? process.env[fallback] : undefined);

  if (!value) {
    throw new Error(`Missing required database environment variable: ${primary}`);
  }

  return value;
}

function createClient() {
  const connectionString = process.env.DATABASE_URL || process.env.DB_URL;

  if (connectionString) {
    return new Client({ connectionString });
  }

  return new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || process.env.PGUSER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
    database: getRequiredEnv('DB_DATABASE', 'DB_NAME'),
    ssl:
      process.env.DB_SSL === 'true'
        ? {
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
          }
        : undefined,
  });
}

async function assertTableExists(client: PgClient, tableName: string) {
  const result = await client.query<{ exists: boolean }>(
    `SELECT to_regclass($1) IS NOT NULL AS "exists"`,
    [`public.${tableName}`],
  );

  if (!result.rows[0]?.exists) {
    throw new Error(`Required table public.${tableName} does not exist`);
  }
}

async function assertUserIdColumnIsUuid(client: PgClient) {
  const result = await client.query<{ udt_name: string; is_nullable: string }>(
    `
      SELECT udt_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'backtest_results'
        AND column_name = 'user_id'
    `,
  );

  const column = result.rows[0];

  if (!column) {
    throw new Error('backtest_results.user_id was not created');
  }

  if (column.udt_name !== 'uuid') {
    throw new Error(
      `backtest_results.user_id type is ${column.udt_name}; expected uuid. Stop for manual migration.`,
    );
  }

  if (column.is_nullable !== 'YES') {
    throw new Error('backtest_results.user_id must remain nullable for legacy rows');
  }
}

async function addForeignKeyIfMissing(client: PgClient) {
  const constraintName = 'fk_backtest_results_user_id_users_id';
  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = $1
          AND conrelid = 'public.backtest_results'::regclass
      ) AS "exists"
    `,
    [constraintName],
  );

  if (result.rows[0]?.exists) {
    print(`- 外键已存在：${constraintName}`);
    return;
  }

  await client.query(`
    ALTER TABLE backtest_results
    ADD CONSTRAINT ${constraintName}
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
  `);
  print(`- 已创建外键：${constraintName}`);
}

async function backfillSingleUserRows(client: PgClient) {
  const userCountResult = await client.query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM users',
  );
  const userCount = Number(userCountResult.rows[0]?.count || 0);
  const nullCountResult = await client.query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM backtest_results WHERE user_id IS NULL',
  );
  const nullCount = Number(nullCountResult.rows[0]?.count || 0);

  if (nullCount === 0) {
    print('- 无需回填：backtest_results.user_id 已全部有值');
    return;
  }

  if (userCount === 0) {
    print(`- 跳过回填：users 表为空，保留 ${nullCount} 条旧回测 user_id=NULL`);
    return;
  }

  if (userCount > 1) {
    print(
      `- 跳过回填：检测到 ${userCount} 个用户，无法安全判断 ${nullCount} 条旧回测归属。请人工按业务归属更新 user_id。`,
    );
    return;
  }

  const userResult = await client.query<{ id: string }>(
    'SELECT id FROM users ORDER BY created_at ASC NULLS LAST, id ASC LIMIT 1',
  );
  const userId = userResult.rows[0]?.id;

  if (!userId) {
    print('- 跳过回填：未找到可用用户');
    return;
  }

  const updateResult = await client.query(
    'UPDATE backtest_results SET user_id = $1 WHERE user_id IS NULL',
    [userId],
  );
  print(`- 已回填旧回测：${updateResult.rowCount || 0} 条 -> user_id=${userId}`);
}

async function assertNoOrphanUserId(client: PgClient) {
  const result = await client.query<{ count: string }>(`
    SELECT COUNT(*) AS count
    FROM backtest_results br
    LEFT JOIN users u ON u.id = br.user_id
    WHERE br.user_id IS NOT NULL
      AND u.id IS NULL
  `);
  const orphanCount = Number(result.rows[0]?.count || 0);

  if (orphanCount > 0) {
    throw new Error(
      `Found ${orphanCount} backtest_results rows with non-existent user_id. Fix them before adding the foreign key.`,
    );
  }
}

async function migrate({ dryRun }: { dryRun: boolean }) {
  loadEnvFile(ENV_PATH);

  const client = createClient();
  await client.connect();

  try {
    print(`开始迁移 backtest_results.user_id${dryRun ? '（dry-run，将回滚）' : ''}`);
    await client.query('BEGIN');
    await assertTableExists(client, 'users');
    await assertTableExists(client, 'backtest_results');

    await client.query('ALTER TABLE backtest_results ADD COLUMN IF NOT EXISTS user_id uuid');
    print('- 已确保 nullable uuid 列：backtest_results.user_id');

    await assertUserIdColumnIsUuid(client);

    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_backtest_results_user_id ON backtest_results (user_id)',
    );
    print('- 已确保索引：idx_backtest_results_user_id');

    await backfillSingleUserRows(client);
    await assertNoOrphanUserId(client);
    await addForeignKeyIfMissing(client);

    if (dryRun) {
      await client.query('ROLLBACK');
      print('dry-run 完成：已回滚所有变更');
      return;
    }

    await client.query('COMMIT');
    print('迁移完成');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

function printHelp() {
  print(
    `
Usage:
  pnpm --filter @fundtrader/backend migrate:backtest-user-id [-- --dry-run]

Environment:
  读取仓库根目录 .env，也支持当前 shell 中的 DB_HOST / DB_PORT / DB_USERNAME / DB_PASSWORD / DB_DATABASE。

Behavior:
  1. 幂等添加 backtest_results.user_id nullable uuid 列
  2. 幂等添加 idx_backtest_results_user_id 索引
  3. 单用户部署时把旧 NULL user_id 回填为唯一用户
  4. 无用户时不回填，多用户时不自动回填
  5. 幂等添加 users(id) 外键，ON DELETE SET NULL
`.trim(),
  );
}

const args = new Set(process.argv.slice(2));

if (args.has('--help') || args.has('-h')) {
  printHelp();
} else {
  migrate({ dryRun: args.has('--dry-run') }).catch((error) => {
    console.error(formatError(error));
    process.exitCode = 1;
  });
}
