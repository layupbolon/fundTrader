import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Position, Transaction, TransactionType, TransactionStatus } from '../../models';
import { TiantianBrokerService } from '../../services/broker/tiantian.service';
import { NotifyService } from '../../services/notify/notify.service';

/**
 * 止盈配置接口
 *
 * 定义止盈策略的配置参数，支持固定目标止盈和移动止盈。
 */
interface TakeProfitConfig {
  /**
   * 目标收益率
   * 例如：0.20 表示收益率达到 20% 时止盈
   */
  target_rate: number;

  /**
   * 卖出比例
   * 例如：0.5 表示卖出 50% 仓位，1.0 表示全部卖出
   */
  sell_ratio: number;

  /**
   * 移动止盈回撤率（可选）
   * 从最高收益率回撤超过该比例时触发止盈
   * 例如：0.05 表示从最高点回撤 5% 时卖出
   *
   * 用途：锁定利润，避免收益大幅回吐
   */
  trailing_stop?: number;
}

/**
 * 止损配置接口
 *
 * 定义止损策略的配置参数，用于控制最大亏损。
 */
interface StopLossConfig {
  /**
   * 最大回撤率（负数）
   * 例如：-0.10 表示亏损达到 -10% 时止损
   */
  max_drawdown: number;

  /**
   * 卖出比例
   * 例如：0.5 表示卖出 50% 仓位，1.0 表示全部卖出
   */
  sell_ratio: number;
}

/**
 * 止盈止损策略引擎
 *
 * 实现基金持仓的止盈止损功能，帮助投资者锁定利润和控制风险。
 * 支持固定目标止盈、移动止盈和最大回撤止损三种策略。
 *
 * 核心功能：
 * 1. 检查持仓是否触发止盈条件
 * 2. 检查持仓是否触发止损条件
 * 3. 执行卖出操作并记录交易
 *
 * 策略类型：
 * - 固定目标止盈：收益率达到目标值时卖出
 * - 移动止盈（Trailing Stop）：从最高收益率回撤超过阈值时卖出
 * - 最大回撤止损：亏损达到最大容忍值时卖出
 *
 * 使用场景：
 * - 锁定利润：达到预期收益后及时止盈
 * - 控制风险：避免亏损扩大
 * - 情绪管理：自动执行，避免贪婪和恐惧
 *
 * 业务规则：
 * - 定时任务定期检查持仓（如每小时）
 * - 触发条件后自动创建卖出交易
 * - 支持部分卖出（如卖出 50% 仓位）
 * - 执行结果通过通知服务发送给用户
 */
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

  /**
   * 检查是否触发止盈条件
   *
   * 支持两种止盈策略：
   * 1. 固定目标止盈：收益率达到目标值
   * 2. 移动止盈：从最高收益率回撤超过阈值
   *
   * @param position 持仓信息
   * @param config 止盈配置
   * @returns true 表示触发止盈，false 表示未触发
   *
   * @example
   * // 固定目标止盈：收益率达到 20%
   * const shouldTakeProfit = await strategy.checkTakeProfit(position, {
   *   target_rate: 0.20,
   *   sell_ratio: 1.0
   * });
   *
   * @example
   * // 移动止盈：从最高点回撤 5%
   * const shouldTakeProfit = await strategy.checkTakeProfit(position, {
   *   target_rate: 0.20,
   *   sell_ratio: 0.5,
   *   trailing_stop: 0.05
   * });
   */
  async checkTakeProfit(position: Position, config: TakeProfitConfig): Promise<boolean> {
    const { profit_rate } = position;
    const { target_rate, trailing_stop } = config;

    // 简单止盈：达到目标收益率
    // 例如：当前收益率 22%，目标收益率 20%，触发止盈
    if (profit_rate >= target_rate) {
      return true;
    }

    // 移动止盈：从最高点回撤超过阈值
    // 例如：最高收益率 25%，当前收益率 20%，回撤 5%，触发止盈
    if (trailing_stop) {
      const maxProfitRate = await this.getMaxProfitRate(position.id);
      if (maxProfitRate - profit_rate >= trailing_stop) {
        return true;
      }
    }

    return false;
  }

  /**
   * 检查是否触发止损条件
   *
   * 当持仓亏损达到最大容忍值时触发止损，避免亏损进一步扩大。
   *
   * @param position 持仓信息
   * @param config 止损配置
   * @returns true 表示触发止损，false 表示未触发
   *
   * @example
   * // 亏损达到 -10% 时止损
   * const shouldStopLoss = await strategy.checkStopLoss(position, {
   *   max_drawdown: -0.10,
   *   sell_ratio: 1.0
   * });
   */
  async checkStopLoss(position: Position, config: StopLossConfig): Promise<boolean> {
    const { profit_rate } = position;
    const { max_drawdown } = config;

    // 检查是否达到最大回撤
    // 例如：当前收益率 -12%，最大回撤 -10%，触发止损
    return profit_rate <= max_drawdown;
  }

  /**
   * 执行卖出操作
   *
   * 完整的卖出执行流程：
   * 1. 计算卖出份额
   * 2. 调用交易平台接口卖出基金
   * 3. 创建交易记录
   * 4. 发送通知
   *
   * 场外基金卖出特性：
   * - T+1 确认：今天卖出，明天确认到账金额
   * - 净值未知：提交时不知道成交净值
   * - 15:00 前提交按当日净值成交，15:00 后按次日净值成交
   *
   * @param position 持仓信息
   * @param sellRatio 卖出比例（0-1）
   * @param reason 卖出原因（如"止盈"、"止损"）
   * @param strategyId 关联的策略ID
   * @returns 创建的交易记录
   * @throws Error 如果卖出失败
   *
   * @example
   * // 止盈卖出 50% 仓位
   * const transaction = await strategy.executeSell(
   *   position,
   *   0.5,
   *   '止盈',
   *   strategyId
   * );
   */
  async executeSell(
    position: Position,
    sellRatio: number,
    reason: string,
    strategyId: string,
  ): Promise<Transaction> {
    try {
      // 计算卖出份额
      // 例如：持有 1000 份，卖出比例 0.5，则卖出 500 份
      const sharesToSell = position.shares * sellRatio;

      // 执行卖出
      // 调用天天基金交易平台接口，提交卖出订单
      const order = await this.brokerService.sellFund(position.fund_code, sharesToSell);

      // 记录交易
      // 创建交易记录，状态为 PENDING（待确认）
      // T+1 确认后会更新为 CONFIRMED，并填充实际成交金额
      const transaction = this.transactionRepository.create({
        user_id: position.user_id,
        fund_code: position.fund_code,
        type: TransactionType.SELL,
        shares: sharesToSell,
        amount: sharesToSell * position.avg_price, // 预估金额，确认后更新
        status: TransactionStatus.PENDING,
        order_id: order.id,
        strategy_id: strategyId,
      });

      await this.transactionRepository.save(transaction);

      // 发送通知
      // 通过 Telegram/飞书通知用户止盈/止损执行成功
      await this.notifyService.send({
        title: `${reason}触发`,
        content: `基金 ${position.fund_code} 卖出 ${sharesToSell.toFixed(4)} 份\n当前收益率: ${(position.profit_rate * 100).toFixed(2)}%\n订单号: ${order.id}`,
        level: 'warning',
      });

      return transaction;
    } catch (error) {
      // 发送错误通知
      // 如果卖出失败（网络错误、平台限制等），通知用户
      await this.notifyService.send({
        title: `${reason}执行失败`,
        content: `基金 ${position.fund_code} 卖出失败\n错误: ${error.message}`,
        level: 'error',
      });

      throw error;
    }
  }

  /**
   * 获取持仓的历史最高收益率
   *
   * 用于移动止盈策略，计算从最高点的回撤幅度。
   *
   * 注意：当前为简化实现，直接返回当前收益率。
   * 完整实现需要：
   * 1. 记录持仓的历史收益率数据
   * 2. 查询历史最高收益率
   * 3. 定期更新最高收益率记录
   *
   * @param positionId 持仓ID
   * @returns 历史最高收益率
   * @private
   */
  private async getMaxProfitRate(positionId: string): Promise<number> {
    const position = await this.positionRepository.findOne({ where: { id: positionId } });
    return Number(position?.max_profit_rate) || 0;
  }
}
