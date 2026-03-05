import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule } from '@nestjs/throttler';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

// Models
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
} from './models';

// Auth
import { AuthModule, JwtAuthGuard } from './auth';

// Services
import { TiantianBrokerService } from './services/broker/tiantian.service';
import { FundDataService } from './services/data/fund-data.service';
import { NotifyService } from './services/notify/notify.service';
import { TelegramService } from './services/notify/telegram.service';
import { FeishuService } from './services/notify/feishu.service';
import { PositionService } from './services/position/position.service';

// Strategies
import { AutoInvestStrategy } from './core/strategy/auto-invest.strategy';
import { TakeProfitStopLossStrategy } from './core/strategy/take-profit-stop-loss.strategy';
import { GridTradingStrategy } from './core/strategy/grid-trading.strategy';
import { RebalanceStrategy } from './core/strategy/rebalance.strategy';

// Risk Control
import { RiskControlModule } from './core/risk/risk-control.module';

// Analytics
import { AnalyticsModule } from './core/analytics/analytics.module';

// Backtest
import { BacktestEngine } from './core/backtest/backtest.engine';

// Scheduler
import { SchedulerService } from './scheduler/scheduler.service';
import { TradingProcessor } from './scheduler/trading.processor';
import { DataSyncProcessor } from './scheduler/data-sync.processor';
import { ConfirmationProcessor } from './scheduler/confirmation.processor';
import { SnapshotProcessor } from './scheduler/snapshot.processor';
import { HealthCheckProcessor } from './scheduler/health-check.processor';
import { LogCleanupProcessor } from './scheduler/log-cleanup.processor';
import { BackupProcessor } from './scheduler/backup.processor';

// Trading Confirmation
import { TradingConfirmationModule } from './core/trading/trading-confirmation.module';

// Monitoring
import { MonitoringModule } from './core/monitoring/monitoring.module';

// Logger
import { LoggerModule } from './core/logger/logger.module';

// Backup
import { BackupModule } from './core/backup/backup.module';

// API Controllers
import {
  StrategyController,
  PositionController,
  TransactionController,
  FundController,
  BacktestController,
  RiskController,
  AnalyticsController,
} from './api/controllers';
import { UserController } from './api/user.controller';
import { LogController } from './api/log.controller';
import { BackupController } from './api/backup.controller';

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.join(__dirname, '../../../.env'), // 指向根目录的 .env 文件
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
        synchronize: process.env.NODE_ENV !== 'production',
        logging: process.env.NODE_ENV === 'development',
      }),
      inject: [ConfigService],
    }),

    // TypeORM 实体注册
    TypeOrmModule.forFeature([
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
    ]),

    // Bull 队列模块
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

    BullModule.registerQueue(
      { name: 'trading' },
      { name: 'data-sync' },
      { name: 'health-check' },
      { name: 'log-cleanup' },
      { name: 'backup' },
    ),

    // Auth
    AuthModule,

    // Risk Control
    RiskControlModule,

    // Trading Confirmation
    TradingConfirmationModule,

    // Analytics
    AnalyticsModule,

    // Monitoring
    MonitoringModule,

    // Logger
    LoggerModule,

    // Backup
    BackupModule,
  ],
  providers: [
    // Global JWT guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },

    // Services
    TiantianBrokerService,
    FundDataService,
    NotifyService,
    TelegramService,
    FeishuService,
    PositionService,

    // Strategies
    AutoInvestStrategy,
    TakeProfitStopLossStrategy,
    GridTradingStrategy,
    RebalanceStrategy,

    // Backtest
    BacktestEngine,

    // Scheduler
    SchedulerService,
    TradingProcessor,
    DataSyncProcessor,
    ConfirmationProcessor,
    SnapshotProcessor,
    HealthCheckProcessor,
    LogCleanupProcessor,
    BackupProcessor,
  ],
  controllers: [
    StrategyController,
    PositionController,
    TransactionController,
    FundController,
    BacktestController,
    UserController,
    RiskController,
    AnalyticsController,
    LogController,
    BackupController,
  ],
})
export class AppModule {}
