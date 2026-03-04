import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { TradingConfirmationService } from '../core/trading/trading-confirmation.service';

/**
 * 确认超时处理器
 *
 * 定期检查并取消超时的交易确认请求。
 * 运行频率：每 5 分钟执行一次。
 */
@Processor('trading')
@Injectable()
export class ConfirmationProcessor {
  private readonly logger = new Logger(ConfirmationProcessor.name);

  constructor(
    private readonly tradingConfirmationService: TradingConfirmationService,
  ) {}

  /**
   * 处理确认超时检查任务
   *
   * 由定时任务调度，每 5 分钟执行一次。
   * 检查所有超过 confirmation_deadline 的 PENDING_CONFIRMATION 交易，
   * 自动取消并发送通知。
   *
   * @param job Bull 任务对象
   * @returns 取消的交易数量
   */
  @Process('check-confirmation-timeout')
  async handleCheckConfirmationTimeout(_job: Job): Promise<number> {
    this.logger.debug('Running confirmation timeout check...');

    try {
      const cancelledCount = await this.tradingConfirmationService.cancelTimeoutTransactions();
      this.logger.log(`Confirmation timeout check completed, cancelled ${cancelledCount} transactions`);
      return cancelledCount;
    } catch (error) {
      this.logger.error(`Failed to check confirmation timeout: ${error.message}`);
      throw error;
    }
  }
}
