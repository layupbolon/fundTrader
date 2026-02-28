import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Strategy, Position, Transaction, StrategyType, TransactionType, TransactionStatus } from '../models';
import { AutoInvestStrategy } from '../core/strategy/auto-invest.strategy';
import { TakeProfitStopLossStrategy } from '../core/strategy/take-profit-stop-loss.strategy';
import { TiantianBrokerService } from '../services/broker/tiantian.service';
import { NotifyService } from '../services/notify/notify.service';
import { PositionService } from '../services/position/position.service';

@Processor('trading')
@Injectable()
export class TradingProcessor {
  constructor(
    @InjectRepository(Strategy)
    private strategyRepository: Repository<Strategy>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private autoInvestStrategy: AutoInvestStrategy,
    private takeProfitStopLossStrategy: TakeProfitStopLossStrategy,
    private brokerService: TiantianBrokerService,
    private notifyService: NotifyService,
    private positionService: PositionService,
  ) {}

  @Process('check-auto-invest')
  async handleAutoInvest(_job: Job) {
    console.log('Checking auto-invest strategies...');

    const strategies = await this.strategyRepository.find({
      where: { type: StrategyType.AUTO_INVEST, enabled: true },
    });

    for (const strategy of strategies) {
      try {
        if (await this.autoInvestStrategy.shouldExecute(strategy)) {
          await this.autoInvestStrategy.execute(strategy);
        }
      } catch (error) {
        console.error(`Failed to execute auto-invest for strategy ${strategy.id}:`, error);
      }
    }
  }

  @Process('check-take-profit-stop-loss')
  async handleTakeProfitStopLoss(_job: Job) {
    console.log('Checking take-profit and stop-loss...');

    const positions = await this.positionRepository.find({
      relations: ['user'],
    });

    for (const position of positions) {
      try {
        // 获取该持仓的止盈止损策略
        const takeProfitStrategies = await this.strategyRepository.find({
          where: {
            user_id: position.user_id,
            fund_code: position.fund_code,
            type: StrategyType.TAKE_PROFIT,
            enabled: true,
          },
        });

        const stopLossStrategies = await this.strategyRepository.find({
          where: {
            user_id: position.user_id,
            fund_code: position.fund_code,
            type: StrategyType.STOP_LOSS,
            enabled: true,
          },
        });

        // 检查止盈
        for (const strategy of takeProfitStrategies) {
          if (await this.takeProfitStopLossStrategy.checkTakeProfit(position, strategy.config)) {
            await this.takeProfitStopLossStrategy.executeSell(
              position,
              strategy.config.sell_ratio,
              '止盈',
              strategy.id,
            );
          }
        }

        // 检查止损
        for (const strategy of stopLossStrategies) {
          if (await this.takeProfitStopLossStrategy.checkStopLoss(position, strategy.config)) {
            await this.takeProfitStopLossStrategy.executeSell(
              position,
              strategy.config.sell_ratio,
              '止损',
              strategy.id,
            );
          }
        }
      } catch (error) {
        console.error(`Failed to check take-profit/stop-loss for position ${position.id}:`, error);
      }
    }
  }

  @Process('confirm-pending-transactions')
  async handleConfirmPendingTransactions(_job: Job) {
    console.log('Checking pending transactions for confirmation...');

    // Find transactions that are PENDING and were submitted more than 1 day ago
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    oneDayAgo.setHours(0, 0, 0, 0);

    const pendingTransactions = await this.transactionRepository
      .createQueryBuilder('t')
      .where('t.status = :status', { status: TransactionStatus.PENDING })
      .andWhere('t.submitted_at < :cutoff', { cutoff: oneDayAgo })
      .getMany();

    for (const transaction of pendingTransactions) {
      try {
        if (!transaction.order_id) {
          console.warn(`Transaction ${transaction.id} has no order_id, skipping`);
          continue;
        }

        const orderStatus = await this.brokerService.getOrderStatus(transaction.order_id);

        if (orderStatus.status === 'CONFIRMED') {
          await this.transactionRepository.update(transaction.id, {
            status: TransactionStatus.CONFIRMED,
            confirmed_at: new Date(),
            confirmed_shares: orderStatus.shares,
            confirmed_price: orderStatus.price,
            shares: orderStatus.shares,
            price: orderStatus.price,
          });

          // 更新持仓
          if (transaction.type === TransactionType.BUY) {
            await this.positionService.updatePositionOnBuy(
              transaction.user_id,
              transaction.fund_code,
              orderStatus.shares,
              orderStatus.price,
            );
          } else if (transaction.type === TransactionType.SELL) {
            await this.positionService.updatePositionOnSell(
              transaction.user_id,
              transaction.fund_code,
              orderStatus.shares,
              orderStatus.price,
            );
          }

          await this.notifyService.send({
            title: '交易确认成功',
            content: `基金 ${transaction.fund_code} 交易已确认\n份额: ${orderStatus.shares}\n净值: ${orderStatus.price}\n订单号: ${transaction.order_id}`,
            level: 'info',
          });
        } else if (orderStatus.status === 'FAILED') {
          await this.transactionRepository.update(transaction.id, {
            status: TransactionStatus.FAILED,
            confirmed_at: new Date(),
          });

          await this.notifyService.send({
            title: '交易确认失败',
            content: `基金 ${transaction.fund_code} 交易失败\n订单号: ${transaction.order_id}\n原因: ${orderStatus.reason || '未知'}`,
            level: 'error',
          });
        }
        // If status is still PENDING on the broker side, we just skip and check again next time
      } catch (error) {
        console.error(`Failed to confirm transaction ${transaction.id}:`, error);
      }
    }
  }

  @Process('refresh-position-values')
  async handleRefreshPositionValues(_job: Job) {
    console.log('Refreshing position values...');

    try {
      await this.positionService.refreshAllPositionValues();
    } catch (error) {
      console.error('Failed to refresh position values:', error);
    }
  }

  @Process('keep-session-alive')
  async handleKeepSessionAlive(_job: Job) {
    console.log('Keeping session alive...');

    try {
      await this.brokerService.keepAlive();
    } catch (error) {
      console.error('Failed to keep session alive:', error);
    }
  }
}
