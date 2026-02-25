import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Position, Strategy, Transaction, TransactionType, TransactionStatus } from '../../models';
import { TiantianBrokerService } from '../../services/broker/tiantian.service';
import { NotifyService } from '../../services/notify/notify.service';

interface TakeProfitConfig {
  target_rate: number;
  sell_ratio: number;
  trailing_stop?: number;
}

interface StopLossConfig {
  max_drawdown: number;
  sell_ratio: number;
}

@Injectable()
export class TakeProfitStopLossStrategy {
  constructor(
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private brokerService: TiantianBrokerService,
    private notifyService: NotifyService,
  ) {}

  async checkTakeProfit(position: Position, config: TakeProfitConfig): Promise<boolean> {
    const { profit_rate } = position;
    const { target_rate, trailing_stop } = config;

    // 简单止盈：达到目标收益率
    if (profit_rate >= target_rate) {
      return true;
    }

    // 移动止盈：从最高点回撤超过阈值
    if (trailing_stop) {
      const maxProfitRate = await this.getMaxProfitRate(position.id);
      if (maxProfitRate - profit_rate >= trailing_stop) {
        return true;
      }
    }

    return false;
  }

  async checkStopLoss(position: Position, config: StopLossConfig): Promise<boolean> {
    const { profit_rate } = position;
    const { max_drawdown } = config;

    return profit_rate <= max_drawdown;
  }

  async executeSell(
    position: Position,
    sellRatio: number,
    reason: string,
    strategyId: string,
  ): Promise<Transaction> {
    try {
      const sharesToSell = position.shares * sellRatio;

      // 执行卖出
      const order = await this.brokerService.sellFund(position.fund_code, sharesToSell);

      // 记录交易
      const transaction = this.transactionRepository.create({
        user_id: position.user_id,
        fund_code: position.fund_code,
        type: TransactionType.SELL,
        shares: sharesToSell,
        amount: sharesToSell * position.avg_price,
        status: TransactionStatus.PENDING,
        order_id: order.id,
        strategy_id: strategyId,
      });

      await this.transactionRepository.save(transaction);

      // 发送通知
      await this.notifyService.send({
        title: `${reason}触发`,
        content: `基金 ${position.fund_code} 卖出 ${sharesToSell.toFixed(4)} 份\n当前收益率: ${(position.profit_rate * 100).toFixed(2)}%\n订单号: ${order.id}`,
        level: 'warning',
      });

      return transaction;
    } catch (error) {
      // 发送错误通知
      await this.notifyService.send({
        title: `${reason}执行失败`,
        content: `基金 ${position.fund_code} 卖出失败\n错误: ${error.message}`,
        level: 'error',
      });

      throw error;
    }
  }

  private async getMaxProfitRate(positionId: string): Promise<number> {
    // 从历史记录中获取最高收益率
    // 简化实现：返回当前收益率
    const position = await this.positionRepository.findOne({ where: { id: positionId } });
    return position?.profit_rate || 0;
  }
}
