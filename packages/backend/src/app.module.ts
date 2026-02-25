import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule } from '@nestjs/throttler';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

// Models
import { User, Fund, FundNav, Position, Transaction, Strategy, BacktestResult } from './models';

// Services
import { TiantianBrokerService } from './services/broker/tiantian.service';
import { FundDataService } from './services/data/fund-data.service';
import { NotifyService } from './services/notify/notify.service';
import { TelegramService } from './services/notify/telegram.service';
import { FeishuService } from './services/notify/feishu.service';

// Strategies
import { AutoInvestStrategy } from './core/strategy/auto-invest.strategy';
import { TakeProfitStopLossStrategy } from './core/strategy/take-profit-stop-loss.strategy';

// Backtest
import { BacktestEngine } from './core/backtest/backtest.engine';

// Scheduler
import { SchedulerService } from './scheduler/scheduler.service';
import { TradingProcessor } from './scheduler/trading.processor';
import { DataSyncProcessor } from './scheduler/data-sync.processor';

// API Controllers
import {
  StrategyController,
  PositionController,
  TransactionController,
  FundController,
  BacktestController,
} from './api/controllers';

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => {
          const configPath = path.join(__dirname, '../config/default.yml');
          let fileContents = fs.readFileSync(configPath, 'utf8');

          // Replace environment variables in YAML
          fileContents = fileContents.replace(/\$\{(\w+)\}/g, (_, envVar) => {
            return process.env[envVar] || '';
          });

          return yaml.load(fileContents) as Record<string, unknown>;
        },
      ],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // 数据库模块
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host') || process.env.DB_HOST,
        port: parseInt(configService.get('database.port') || process.env.DB_PORT || '5432'),
        username: configService.get('database.username') || process.env.DB_USERNAME,
        password: configService.get('database.password') || process.env.DB_PASSWORD,
        database: configService.get('database.database') || process.env.DB_DATABASE,
        entities: [User, Fund, FundNav, Position, Transaction, Strategy, BacktestResult],
        synchronize: process.env.NODE_ENV !== 'production',
        logging: process.env.NODE_ENV === 'development',
      }),
      inject: [ConfigService],
    }),

    // TypeORM实体注册
    TypeOrmModule.forFeature([
      User,
      Fund,
      FundNav,
      Position,
      Transaction,
      Strategy,
      BacktestResult,
    ]),

    // Bull队列模块
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('redis.host') || process.env.REDIS_HOST || 'localhost',
          port: parseInt(configService.get('redis.port') || process.env.REDIS_PORT || '6379'),
        },
      }),
      inject: [ConfigService],
    }),

    BullModule.registerQueue({ name: 'trading' }, { name: 'data-sync' }),
  ],
  providers: [
    // Services
    TiantianBrokerService,
    FundDataService,
    NotifyService,
    TelegramService,
    FeishuService,

    // Strategies
    AutoInvestStrategy,
    TakeProfitStopLossStrategy,

    // Backtest
    BacktestEngine,

    // Scheduler
    SchedulerService,
    TradingProcessor,
    DataSyncProcessor,
  ],
  controllers: [
    StrategyController,
    PositionController,
    TransactionController,
    FundController,
    BacktestController,
  ],
})
export class AppModule {}
