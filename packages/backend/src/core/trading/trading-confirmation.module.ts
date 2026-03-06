import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../../models';
import { TradingConfirmationService } from './trading-confirmation.service';
import { NotifyService } from '../../services/notify/notify.service';
import { TelegramService } from '../../services/notify/telegram.service';
import { FeishuService } from '../../services/notify/feishu.service';
import { RiskControlModule } from '../risk/risk-control.module';

/**
 * 交易确认模块
 *
 * 提供大额交易确认功能的模块封装。
 */
@Module({
  imports: [TypeOrmModule.forFeature([Transaction]), RiskControlModule],
  providers: [TradingConfirmationService, NotifyService, TelegramService, FeishuService],
  exports: [TradingConfirmationService],
})
export class TradingConfirmationModule {}
