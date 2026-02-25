import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Strategy,
  Transaction,
  TransactionType,
  TransactionStatus,
  InvestFrequency,
} from '../../models';
import { TiantianBrokerService } from '../../services/broker/tiantian.service';
import { NotifyService } from '../../services/notify/notify.service';
import { isTradeTime, isWorkday } from '../../utils';

interface AutoInvestConfig {
  amount: number;
  frequency: InvestFrequency;
  day_of_week?: number;
  day_of_month?: number;
  start_date: Date;
  end_date?: Date;
}

@Injectable()
export class AutoInvestStrategy {
  constructor(
    @InjectRepository(Strategy)
    private strategyRepository: Repository<Strategy>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private brokerService: TiantianBrokerService,
    private notifyService: NotifyService,
  ) {}

  async shouldExecute(strategy: Strategy): Promise<boolean> {
    const config = strategy.config as AutoInvestConfig;
    const now = new Date();

    // 检查策略是否启用
    if (!strategy.enabled) {
      return false;
    }

    // 检查是否在有效期内
    if (config.start_date && now < new Date(config.start_date)) {
      return false;
    }

    if (config.end_date && now > new Date(config.end_date)) {
      return false;
    }

    // 检查是否为交易时间
    if (!isTradeTime()) {
      return false;
    }

    // 根据频率检查是否需要执行
    switch (config.frequency) {
      case InvestFrequency.DAILY:
        return isWorkday(now);

      case InvestFrequency.WEEKLY:
        return now.getDay() === (config.day_of_week || 1);

      case InvestFrequency.MONTHLY:
        return now.getDate() === (config.day_of_month || 1);

      default:
        return false;
    }
  }

  async execute(strategy: Strategy): Promise<Transaction> {
    const config = strategy.config as AutoInvestConfig;
    const { fund_code } = strategy;
    const { amount } = config;

    try {
      // 检查交易时间
      if (!isTradeTime()) {
        throw new Error('非交易时间');
      }

      // 执行买入
      const order = await this.brokerService.buyFund(fund_code, amount);

      // 记录交易
      const transaction = this.transactionRepository.create({
        user_id: strategy.user_id,
        fund_code,
        type: TransactionType.BUY,
        amount,
        status: TransactionStatus.PENDING,
        order_id: order.id,
        strategy_id: strategy.id,
      });

      await this.transactionRepository.save(transaction);

      // 发送通知
      await this.notifyService.send({
        title: '定投执行成功',
        content: `基金 ${fund_code} 买入 ${amount} 元\n订单号: ${order.id}`,
        level: 'info',
      });

      return transaction;
    } catch (error) {
      // 发送错误通知
      await this.notifyService.send({
        title: '定投执行失败',
        content: `基金 ${fund_code} 买入失败\n错误: ${error.message}`,
        level: 'error',
      });

      throw error;
    }
  }
}
