import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Strategy,
  Position,
  Transaction,
  TransactionType,
  TransactionStatus,
  InvestFrequency,
} from '../../models';
import { TiantianBrokerService } from '../../services/broker/tiantian.service';
import { FundDataService } from '../../services/data/fund-data.service';
import { NotifyService } from '../../services/notify/notify.service';
import { isTradeTime, isWorkday } from '../../utils';

interface TargetAllocation {
  fund_code: string;
  target_weight: number;
}

interface RebalanceConfig {
  target_allocations: TargetAllocation[];
  rebalance_threshold: number;
  frequency: InvestFrequency;
}

interface RebalanceOrder {
  fund_code: string;
  action: 'BUY' | 'SELL';
  amount: number;
}

@Injectable()
export class RebalanceStrategy {
  constructor(
    @InjectRepository(Strategy)
    private strategyRepository: Repository<Strategy>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private fundDataService: FundDataService,
    private brokerService: TiantianBrokerService,
    private notifyService: NotifyService,
  ) {}

  async getCurrentAllocations(
    userId: string,
    fundCodes: string[],
  ): Promise<Record<string, number>> {
    const positions = await this.positionRepository.find({
      where: fundCodes.map((code) => ({ user_id: userId, fund_code: code })),
    });

    let totalValue = 0;
    const values: Record<string, number> = {};

    for (const code of fundCodes) {
      const position = positions.find((p) => p.fund_code === code);
      if (position) {
        const navRecord = await this.fundDataService.getFundNav(code);
        const nav = navRecord ? Number(navRecord.nav) : 0;
        const value = Number(position.shares) * nav;
        values[code] = value;
        totalValue += value;
      } else {
        values[code] = 0;
      }
    }

    const allocations: Record<string, number> = {};
    for (const code of fundCodes) {
      allocations[code] = totalValue > 0 ? values[code] / totalValue : 0;
    }

    return allocations;
  }

  computeRebalanceOrders(
    current: Record<string, number>,
    targets: TargetAllocation[],
    totalValue: number,
    threshold: number,
  ): RebalanceOrder[] {
    const orders: RebalanceOrder[] = [];

    for (const target of targets) {
      const currentWeight = current[target.fund_code] || 0;
      const deviation = currentWeight - target.target_weight;

      if (Math.abs(deviation) >= threshold) {
        const amount = Math.abs(deviation) * totalValue;

        if (deviation > 0) {
          orders.push({ fund_code: target.fund_code, action: 'SELL', amount });
        } else {
          orders.push({ fund_code: target.fund_code, action: 'BUY', amount });
        }
      }
    }

    return orders;
  }

  async shouldExecute(strategy: Strategy): Promise<boolean> {
    if (!strategy.enabled) {
      return false;
    }

    if (!isTradeTime()) {
      return false;
    }

    const config = strategy.config as RebalanceConfig;
    const now = new Date();

    // Check frequency
    switch (config.frequency) {
      case InvestFrequency.DAILY:
        if (!isWorkday(now)) return false;
        break;
      case InvestFrequency.WEEKLY:
        if (now.getDay() !== 1) return false; // Monday
        break;
      case InvestFrequency.MONTHLY:
        if (now.getDate() !== 1) return false; // 1st of month
        break;
    }

    // Check if any deviation exceeds threshold
    const fundCodes = config.target_allocations.map((a) => a.fund_code);
    const currentAllocations = await this.getCurrentAllocations(strategy.user_id, fundCodes);

    for (const target of config.target_allocations) {
      const current = currentAllocations[target.fund_code] || 0;
      if (Math.abs(current - target.target_weight) >= config.rebalance_threshold) {
        return true;
      }
    }

    return false;
  }

  async execute(strategy: Strategy): Promise<Transaction[]> {
    const config = strategy.config as RebalanceConfig;

    if (!isTradeTime()) {
      throw new Error('非交易时间');
    }

    const fundCodes = config.target_allocations.map((a) => a.fund_code);
    const currentAllocations = await this.getCurrentAllocations(strategy.user_id, fundCodes);

    // Calculate total portfolio value
    let totalValue = 0;
    for (const code of fundCodes) {
      const position = await this.positionRepository.findOne({
        where: { user_id: strategy.user_id, fund_code: code },
      });
      if (position) {
        const navRecord = await this.fundDataService.getFundNav(code);
        const nav = navRecord ? Number(navRecord.nav) : 0;
        totalValue += Number(position.shares) * nav;
      }
    }

    const orders = this.computeRebalanceOrders(
      currentAllocations,
      config.target_allocations,
      totalValue,
      config.rebalance_threshold,
    );

    const transactions: Transaction[] = [];

    try {
      for (const order of orders) {
        if (order.action === 'BUY') {
          const brokerOrder = await this.brokerService.buyFund(order.fund_code, order.amount);
          const transaction = this.transactionRepository.create({
            user_id: strategy.user_id,
            fund_code: order.fund_code,
            type: TransactionType.BUY,
            amount: order.amount,
            status: TransactionStatus.PENDING,
            order_id: brokerOrder.id,
            strategy_id: strategy.id,
          });
          await this.transactionRepository.save(transaction);
          transactions.push(transaction);
        } else {
          const navRecord = await this.fundDataService.getFundNav(order.fund_code);
          const nav = navRecord ? Number(navRecord.nav) : 1;
          const sellShares = order.amount / nav;
          const brokerOrder = await this.brokerService.sellFund(order.fund_code, sellShares);
          const transaction = this.transactionRepository.create({
            user_id: strategy.user_id,
            fund_code: order.fund_code,
            type: TransactionType.SELL,
            amount: order.amount,
            shares: sellShares,
            status: TransactionStatus.PENDING,
            order_id: brokerOrder.id,
            strategy_id: strategy.id,
          });
          await this.transactionRepository.save(transaction);
          transactions.push(transaction);
        }
      }

      await this.strategyRepository.update(strategy.id, {
        last_executed_at: new Date(),
      });

      const orderSummary = orders
        .map((o) => `${o.fund_code}: ${o.action} ${o.amount.toFixed(2)}元`)
        .join('\n');

      await this.notifyService.send({
        title: '再平衡执行完成',
        content: `组合再平衡完成\n${orderSummary}`,
        level: 'info',
      });

      return transactions;
    } catch (error) {
      await this.notifyService.send({
        title: '再平衡执行失败',
        content: `组合再平衡失败\n错误: ${error.message}`,
        level: 'error',
      });
      throw error;
    }
  }
}
