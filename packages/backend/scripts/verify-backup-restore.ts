import { Client } from 'pg';

const tables = ['users', 'funds', 'transactions', 'positions', 'strategies'];

async function countTables(database: string) {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database,
  });
  await client.connect();
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const result = await client.query(`select count(*)::int as count from ${table}`);
    counts[table] = result.rows[0].count;
  }
  await client.end();
  return counts;
}

async function main() {
  const sourceDb = process.env.DB_DATABASE || 'fundtrader';
  const restoredDb = process.env.RESTORE_DB_DATABASE;
  if (!restoredDb) {
    throw new Error('RESTORE_DB_DATABASE is required');
  }
  const source = await countTables(sourceDb);
  const restored = await countTables(restoredDb);
  process.stdout.write(`${JSON.stringify({ source, restored }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(
    `Backup restore verification failed: ${error instanceof Error ? error.message : error}\n`,
  );
  process.exit(1);
});
