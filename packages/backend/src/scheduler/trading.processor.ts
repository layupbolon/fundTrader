import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  Strategy,
  Position,
  Transaction,
  StrategyType,
  TransactionType,
  TransactionStatus,
} from '../models';
import { AutoInvestStrategy } from '../core/strategy/auto-invest.strategy';
import { TakeProfitStopLossStrategy } from '../core/strategy/take-profit-stop-loss.strategy';
import { GridTradingStrategy } from '../core/strategy/grid-trading.strategy';
import { RebalanceStrategy } from '../core/strategy/rebalance.strategy';
import { BROKER_ADAPTER, BrokerAdapter, BrokerOrder, hasBrokerEvidence } from '../services/broker';
import { NotifyService } from '../services/notify/notify.service';
import { PositionService } from '../services/position/position.service';
import { OperationLogService } from '../core/logger/operation-log.service';
import { OperationType } from '../models/operation-log.entity';

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
    private gridTradingStrategy: GridTradingStrategy,
    private rebalanceStrategy: RebalanceStrategy,
    @Inject(BROKER_ADAPTER)
    private brokerService: BrokerAdapter,
    private notifyService: NotifyService,
    private positionService: PositionService,
    private operationLogService: OperationLogService,
  ) {}

  @Process('submit-transaction')
  async handleSubmitTransaction(job: Job<{ transaction_id: string; triggered_by?: string }>) {
    const transaction = await this.transactionRepository.findOne({
      where: { id: job.data.transaction_id },
    });
    if (!transaction) {
      return;
    }
    if (transaction.order_id) {
      if (
        [TransactionStatus.CREATED, TransactionStatus.PENDING_SUBMIT].includes(transaction.status)
      ) {
        await this.transactionRepository.update(transaction.id, {
          status: TransactionStatus.SUBMITTED,
        });
      }
      return;
    }
    if (
      ![TransactionStatus.CREATED, TransactionStatus.PENDING_SUBMIT].includes(transaction.status)
    ) {
      return;
    }
    const claimResult = await this.transactionRepository.update(
      {
        id: transaction.id,
        status: In([TransactionStatus.CREATED, TransactionStatus.PENDING_SUBMIT]),
        order_id: IsNull(),
      },
      { status: TransactionStatus.PENDING },
    );
    if (claimResult.affected !== 1) {
      return;
    }

    let order: BrokerOrder;
    try {
      order =
        transaction.type === TransactionType.BUY
          ? await this.brokerService.buyFund(transaction.fund_code, Number(transaction.amount), {
              userId: transaction.user_id,
              transactionId: transaction.id,
            })
          : await this.brokerService.sellFund(transaction.fund_code, Number(transaction.shares), {
              userId: transaction.user_id,
              transactionId: transaction.id,
            });
    } catch (error) {
      const maxAttempts = job.opts.attempts || 1;
      if (job.attemptsMade + 1 >= maxAttempts) {
        await this.transactionRepository.update(transaction.id, {
          status: TransactionStatus.FAILED,
          confirmed_at: new Date(),
        });
        await this.logUserActionSafely(
          transaction.user_id,
          OperationType.TRADE_CONFIRM,
          'trade',
          `交易提交失败 ${transaction.id}`,
          {
            transaction_id: transaction.id,
            old_status: transaction.status,
            new_status: TransactionStatus.FAILED,
            reason: error instanceof Error ? error.message : 'broker_submit_failed',
            manual_intervention_required: hasBrokerEvidence(error)
              ? error.manualInterventionRequired === true
              : false,
            broker_evidence: hasBrokerEvidence(error) ? error.evidence : undefined,
          },
        );
      } else {
        await this.transactionRepository.update(transaction.id, {
          status: TransactionStatus.PENDING_SUBMIT,
        });
      }
      throw error;
    }

    try {
      await this.transactionRepository.update(transaction.id, {
        status: TransactionStatus.SUBMITTED,
        order_id: order.id,
      });
    } catch (error) {
      console.error(
        `Broker submitted transaction ${transaction.id} as order ${order.id}, but local persistence failed. Suppressing Bull retry to avoid duplicate broker submit:`,
        error,
      );
      await this.logUserActionSafely(
        transaction.user_id,
        OperationType.TRADE_CONFIRM,
        'trade',
        `交易提交本地持久化失败 ${transaction.id}`,
        {
          transaction_id: transaction.id,
          order_id: order.id,
          old_status: transaction.status,
          new_status: transaction.status,
          ...this.buildBrokerAuditContext(order),
          reason: error instanceof Error ? error.message : 'broker_order_persist_failed',
        },
      );
      return;
    }

    await this.logUserActionSafely(
      transaction.user_id,
      OperationType.TRADE_CONFIRM,
      'trade',
      `交易提交到券商 ${transaction.id}`,
      {
        transaction_id: transaction.id,
        order_id: order.id,
        old_status: transaction.status,
        new_status: TransactionStatus.SUBMITTED,
        ...this.buildBrokerAuditContext(order),
        reason: 'broker_submit_success',
      },
    );
  }

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
        const tpslStrategies = await this.strategyRepository.find({
          where: {
            user_id: position.user_id,
            fund_code: position.fund_code,
            type: StrategyType.TAKE_PROFIT_STOP_LOSS,
            enabled: true,
          },
        });

        for (const strategy of tpslStrategies) {
          const takeProfitConfig = strategy.config?.take_profit;
          const stopLossConfig = strategy.config?.stop_loss;

          if (
            takeProfitConfig &&
            (await this.takeProfitStopLossStrategy.checkTakeProfit(position, takeProfitConfig))
          ) {
            await this.takeProfitStopLossStrategy.executeSell(
              position,
              takeProfitConfig.sell_ratio,
              '止盈',
              strategy.id,
            );
            continue;
          }
          if (
            stopLossConfig &&
            (await this.takeProfitStopLossStrategy.checkStopLoss(position, stopLossConfig))
          ) {
            await this.takeProfitStopLossStrategy.executeSell(
              position,
              stopLossConfig.sell_ratio,
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

  @Process('check-grid-trading')
  async handleGridTrading(_job: Job) {
    console.log('Checking grid trading strategies...');

    const strategies = await this.strategyRepository.find({
      where: { type: StrategyType.GRID_TRADING, enabled: true },
    });

    for (const strategy of strategies) {
      try {
        if (await this.gridTradingStrategy.shouldExecute(strategy)) {
          await this.gridTradingStrategy.execute(strategy);
        }
      } catch (error) {
        console.error(`Failed to execute grid trading for strategy ${strategy.id}:`, error);
      }
    }
  }

  @Process('check-rebalance')
  async handleRebalance(_job: Job) {
    console.log('Checking rebalance strategies...');

    const strategies = await this.strategyRepository.find({
      where: { type: StrategyType.REBALANCE, enabled: true },
    });

    for (const strategy of strategies) {
      try {
        if (await this.rebalanceStrategy.shouldExecute(strategy)) {
          await this.rebalanceStrategy.execute(strategy);
        }
      } catch (error) {
        console.error(`Failed to execute rebalance for strategy ${strategy.id}:`, error);
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
      .where('t.status IN (:...statuses)', {
        statuses: [TransactionStatus.PENDING, TransactionStatus.SUBMITTED],
      })
      .andWhere('t.submitted_at < :cutoff', { cutoff: oneDayAgo })
      .getMany();

    for (const transaction of pendingTransactions) {
      try {
        if (!transaction.order_id) {
          console.warn(`Transaction ${transaction.id} has no order_id, skipping`);
          continue;
        }

        const orderStatus = await this.brokerService.getOrderStatus(transaction.order_id, {
          userId: transaction.user_id,
          transactionId: transaction.id,
        });

        if (orderStatus.status === 'CONFIRMED') {
          await this.transactionRepository.update(transaction.id, {
            status: TransactionStatus.CONFIRMED,
            confirmed_at: new Date(),
            confirmed_shares: orderStatus.shares,
            confirmed_price: orderStatus.price,
            shares: orderStatus.shares,
            price: orderStatus.price,
          });
          await this.logStatusMigration(transaction, TransactionStatus.CONFIRMED, orderStatus);

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
          await this.logStatusMigration(transaction, TransactionStatus.FAILED, orderStatus);

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

  private async logStatusMigration(
    transaction: Transaction,
    newStatus: TransactionStatus,
    brokerResponse: unknown,
  ) {
    await this.operationLogService.logUserAction(
      transaction.user_id,
      OperationType.TRADE_CONFIRM,
      'trade',
      `交易状态迁移 ${transaction.id}`,
      {
        transaction_id: transaction.id,
        order_id: transaction.order_id,
        old_status: transaction.status,
        new_status: newStatus,
        broker_response: brokerResponse,
      },
    );
  }

  private async logUserActionSafely(
    userId: string,
    operationType: OperationType,
    category: string,
    message: string,
    metadata: Record<string, unknown>,
  ) {
    try {
      await this.operationLogService.logUserAction(
        userId,
        operationType,
        category,
        message,
        metadata,
      );
    } catch (error) {
      console.error(`Failed to write operation log for ${message}:`, error);
    }
  }

  private buildBrokerAuditContext(order: BrokerOrder): Record<string, unknown> {
    const metadata = order.metadata || {};
    return {
      broker_response: order,
      broker_mode: metadata.mode,
      paper_trading_run_id: metadata.mode === 'paper' ? metadata.runId : undefined,
      broker_order_created_at: metadata.createdAt,
    };
  }
}
