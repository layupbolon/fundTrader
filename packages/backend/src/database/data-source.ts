import { DataSource } from 'typeorm';
import {
  BacktestResult,
  Blacklist,
  Fund,
  FundNav,
  OperationLog,
  PortfolioSnapshot,
  Position,
  RiskLimit,
  Strategy,
  Transaction,
  User,
} from '../models';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'fundtrader',
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
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
