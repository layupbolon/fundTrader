import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../../models';
import { TradingConfirmationService } from './trading-confirmation.service';
import { NotifyService } from '../../services/notify/notify.service';
import { TelegramService } from '../../services/notify/telegram.service';
import { FeishuService } from '../../services/notify/feishu.service';
import { RiskControlService } from '../risk/risk-control.service';
import { RiskLimit } from '../../models';

/**
 * 交易确认模块
 *
 * 提供大额交易确认功能的模块封装。
 */
@Module({
  imports: [TypeOrmModule.forFeature([Transaction, RiskLimit])],
  providers: [
    TradingConfirmationService,
    NotifyService,
    TelegramService,
    FeishuService,
    RiskControlService,
  ],
  exports: [TradingConfirmationService],
})
export class TradingConfirmationModule {}
