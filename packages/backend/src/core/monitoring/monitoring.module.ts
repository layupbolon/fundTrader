import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { HealthService } from './health.service';
import { HealthController } from './health.controller';
import { TiantianBrokerService } from '../../services/broker/tiantian.service';
import { NotifyService } from '../../services/notify/notify.service';
import { TelegramService } from '../../services/notify/telegram.service';
import { FeishuService } from '../../services/notify/feishu.service';

/**
 * 监控模块
 *
 * 全局模块，整合健康检查服务。
 *
 * 导出：
 * - HealthService - 供其他模块使用的健康检查服务
 *
 * 依赖：
 * - TypeOrmModule - 用于数据库连接检查
 * - BullModule - 用于定时任务队列
 * - TiantianBrokerService - 用于浏览器会话检查
 * - NotifyService - 用于发送告警通知
 */
@Module({
  imports: [
    // TypeORM 用于数据库检查（使用 forRoot 已有的连接）
    TypeOrmModule,
    // Bull 用于定时健康检查任务
    BullModule.registerQueue({ name: 'health-check' }),
  ],
  providers: [
    HealthService,
    // Broker service for browser session checks
    TiantianBrokerService,
    // Notification services for alerts
    NotifyService,
    TelegramService,
    FeishuService,
  ],
  controllers: [HealthController],
  exports: [HealthService],
})
export class MonitoringModule {}
