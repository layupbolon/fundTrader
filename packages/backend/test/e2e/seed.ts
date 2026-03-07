import 'reflect-metadata';
import { DataSource } from 'typeorm';
import {
  User,
  Fund,
  FundNav,
  Position,
  Transaction,
  Strategy,
  BacktestResult,
  RiskLimit,
  Blacklist,
  PortfolioSnapshot,
  OperationLog,
} from '../../src/models';
import { resetDatabase, seedFund, seedFundNavSeries } from './db-utils';

async function main() {
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.DB_HOST = process.env.DB_HOST || 'localhost';
  process.env.DB_PORT = process.env.DB_PORT || '5432';
  process.env.DB_USERNAME = process.env.DB_USERNAME || 'postgres';
  process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
  process.env.DB_DATABASE = process.env.DB_DATABASE || 'fundtrader';

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: true,
    entities: [
      User,
      Fund,
      FundNav,
      Position,
      Transaction,
      Strategy,
      BacktestResult,
      RiskLimit,
      Blacklist,
      PortfolioSnapshot,
      OperationLog,
    ],
  });

  await dataSource.initialize();

  try {
    await resetDatabase(dataSource);

    await seedFund(dataSource, {
      code: '110011',
      name: '易方达中小盘',
      type: '混合型',
      manager: '张三',
    });

    await seedFund(dataSource, {
      code: '000300',
      name: '沪深300指数增强',
      type: '指数型',
      manager: '李四',
    });

    await seedFundNavSeries(dataSource, {
      fundCode: '110011',
      startDate: '2025-01-01',
      days: 90,
      baseNav: 1.0,
    });

    await seedFundNavSeries(dataSource, {
      fundCode: '000300',
      startDate: '2025-01-01',
      days: 90,
      baseNav: 0.95,
    });

    console.log('E2E seed completed successfully');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('E2E seed failed:', error);
  process.exit(1);
});
