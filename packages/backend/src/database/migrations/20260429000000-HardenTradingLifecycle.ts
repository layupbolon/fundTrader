import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenTradingLifecycle20260429000000 implements MigrationInterface {
  name = 'HardenTradingLifecycle20260429000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TYPE transactions_status_enum ADD VALUE IF NOT EXISTS 'CREATED'",
    );
    await queryRunner.query(
      "ALTER TYPE transactions_status_enum ADD VALUE IF NOT EXISTS 'PENDING_SUBMIT'",
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_transactions_status_submitted_at ON transactions (status, submitted_at)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON transactions (user_id, status)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_transactions_user_status');
    await queryRunner.query('DROP INDEX IF EXISTS idx_transactions_status_submitted_at');
  }
}
