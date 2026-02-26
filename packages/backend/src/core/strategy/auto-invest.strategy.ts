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

/**
 * 定投策略配置接口
 *
 * 定义定投策略的所有配置参数，支持日/周/月三种定投频率。
 */
interface AutoInvestConfig {
  /**
   * 每次定投金额（人民币）
   * 例如：500 表示每次投入 500 元
   */
  amount: number;

  /**
   * 定投频率
   * - DAILY: 每个工作日定投
   * - WEEKLY: 每周固定某天定投
   * - MONTHLY: 每月固定某天定投
   */
  frequency: InvestFrequency;

  /**
   * 周定投：星期几执行（1-7，1=周一，7=周日）
   * 仅当 frequency = WEEKLY 时有效
   * 例如：1 表示每周一定投
   */
  day_of_week?: number;

  /**
   * 月定投：每月几号执行（1-31）
   * 仅当 frequency = MONTHLY 时有效
   * 例如：1 表示每月1号定投
   *
   * 注意：如果某月没有该日期（如2月30日），则跳过该月
   */
  day_of_month?: number;

  /**
   * 定投开始日期
   * 在此日期之前不会执行定投
   */
  start_date: Date;

  /**
   * 定投结束日期（可选）
   * 在此日期之后不会执行定投
   * 如果不设置，则无限期执行
   */
  end_date?: Date;
}

/**
 * 定投策略引擎
 *
 * 实现基金定投功能，支持按日/周/月频率自动买入基金。
 * 定投是一种分散投资风险的策略，通过定期定额投资来平滑市场波动。
 *
 * 核心功能：
 * 1. 判断是否应该执行定投（时间、频率、交易时间检查）
 * 2. 执行定投买入操作
 * 3. 记录交易并发送通知
 *
 * 业务规则：
 * - 只在交易时间执行（工作日 15:00 前）
 * - 根据配置的频率判断是否执行
 * - 自动创建交易记录并提交到交易平台
 * - 执行结果通过通知服务发送给用户
 *
 * 使用场景：
 * - 长期投资：通过定期投资降低择时风险
 * - 强制储蓄：自动扣款，培养投资习惯
 * - 平滑成本：在不同价位买入，平均持仓成本
 */
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

  /**
   * 判断是否应该执行定投
   *
   * 综合检查策略状态、时间范围、交易时间和定投频率，
   * 决定当前时刻是否应该执行定投操作。
   *
   * 检查逻辑（按顺序）：
   * 1. 策略是否启用
   * 2. 是否在有效期内（start_date ~ end_date）
   * 3. 是否为交易时间（工作日 15:00 前）
   * 4. 是否满足定投频率条件
   *
   * @param strategy 定投策略配置
   * @returns true 表示应该执行定投，false 表示不执行
   *
   * @example
   * // 每周一定投
   * const shouldRun = await autoInvestStrategy.shouldExecute(strategy);
   * if (shouldRun) {
   *   await autoInvestStrategy.execute(strategy);
   * }
   */
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
    // 场外基金交易时间：工作日 15:00 前
    if (!isTradeTime()) {
      return false;
    }

    // 根据频率检查是否需要执行
    switch (config.frequency) {
      case InvestFrequency.DAILY:
        // 日定投：每个工作日执行
        return isWorkday(now);

      case InvestFrequency.WEEKLY:
        // 周定投：每周固定某天执行
        // getDay() 返回 0-6（0=周日，1=周一，...，6=周六）
        return now.getDay() === (config.day_of_week || 1);

      case InvestFrequency.MONTHLY:
        // 月定投：每月固定某天执行
        // getDate() 返回 1-31
        return now.getDate() === (config.day_of_month || 1);

      default:
        return false;
    }
  }

  /**
   * 执行定投买入操作
   *
   * 完整的定投执行流程：
   * 1. 检查交易时间
   * 2. 调用交易平台接口买入基金
   * 3. 创建交易记录
   * 4. 发送通知
   *
   * 场外基金交易特性：
   * - T+1 确认：今天买入，明天确认份额
   * - 净值未知：提交时不知道成交净值
   * - 15:00 前提交按当日净值成交，15:00 后按次日净值成交
   *
   * @param strategy 定投策略配置
   * @returns 创建的交易记录
   * @throws Error 如果不在交易时间或交易失败
   *
   * @example
   * try {
   *   const transaction = await autoInvestStrategy.execute(strategy);
   *   console.log(`定投成功，订单号: ${transaction.order_id}`);
   * } catch (error) {
   *   console.error(`定投失败: ${error.message}`);
   * }
   */
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
      // 调用天天基金交易平台接口，提交买入订单
      const order = await this.brokerService.buyFund(fund_code, amount);

      // 记录交易
      // 创建交易记录，状态为 PENDING（待确认）
      // T+1 确认后会更新为 CONFIRMED，并填充 shares 和 price 字段
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
      // 通过 Telegram/飞书通知用户定投执行成功
      await this.notifyService.send({
        title: '定投执行成功',
        content: `基金 ${fund_code} 买入 ${amount} 元\n订单号: ${order.id}`,
        level: 'info',
      });

      return transaction;
    } catch (error) {
      // 发送错误通知
      // 如果定投失败（余额不足、网络错误等），通知用户
      await this.notifyService.send({
        title: '定投执行失败',
        content: `基金 ${fund_code} 买入失败\n错误: ${error.message}`,
        level: 'error',
      });

      throw error;
    }
  }
}
