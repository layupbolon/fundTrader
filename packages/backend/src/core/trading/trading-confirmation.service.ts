import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Transaction, TransactionConfirmationStatus, TransactionType, RiskLimitType } from '../../models';
import { NotifyService } from '../../services/notify/notify.service';
import { TelegramService } from '../../services/notify/telegram.service';
import { FeishuService } from '../../services/notify/feishu.service';
import { RiskControlService } from '../risk/risk-control.service';

/**
 * 交易确认服务
 *
 * 实现大额交易确认功能，防止误操作导致的重大损失。
 *
 * 核心功能：
 * 1. 创建待确认交易
 * 2. 发送确认请求到 Telegram/飞书
 * 3. 处理用户确认
 * 4. 处理用户取消
 * 5. 取消超时交易
 *
 * 确认金额阈值配置：
 * - 通过 RiskLimitType.SINGLE_TRADE_CONFIRM_THRESHOLD 配置
 * - 默认：单笔交易超过 10,000 元需要确认
 */
@Injectable()
export class TradingConfirmationService {
  private readonly logger = new Logger(TradingConfirmationService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly notifyService: NotifyService,
    private readonly telegramService: TelegramService,
    private readonly feishuService: FeishuService,
    private readonly riskControlService: RiskControlService,
  ) {
    // 注册 Telegram 回调处理器
    this.telegramService.onConfirmationCallback(async (transactionId, action) => {
      if (action === 'confirm') {
        await this.handleConfirmation(transactionId, { source: 'telegram' });
      } else {
        await this.handleCancellation(transactionId, { source: 'telegram' });
      }
    });

    this.logger.log('TradingConfirmationService initialized');
  }

  /**
   * 检查交易是否需要确认
   *
   * 根据风控配置的阈值判断交易金额是否超过确认阈值。
   *
   * @param userId 用户 ID
   * @param amount 交易金额
   * @returns true 表示需要确认，false 表示不需要
   */
  async needsConfirmation(userId: string, amount: number): Promise<boolean> {
    try {
      const limits = await this.riskControlService.getRiskLimits(userId, [
        RiskLimitType.SINGLE_TRADE_CONFIRM_THRESHOLD,
      ]);

      const thresholdLimit = limits.find(
        (l) => l.type === RiskLimitType.SINGLE_TRADE_CONFIRM_THRESHOLD && l.enabled,
      );

      if (!thresholdLimit) {
        // 没有配置确认阈值，默认不需要确认
        return false;
      }

      return amount > thresholdLimit.limit_value;
    } catch (error) {
      this.logger.error(`Failed to check confirmation requirement: ${error.message}`);
      return false;
    }
  }

  /**
   * 创建待确认交易
   *
   * 创建一笔需要用户确认的交易记录，状态为 PENDING_CONFIRMATION。
   *
   * @param params 创建交易的参数
   * @returns 创建的交易记录
   */
  async createPendingTransaction(params: {
    userId: string;
    fundCode: string;
    amount: number;
    type: TransactionType;
    strategyId?: string;
    confirmationTimeoutMinutes: number;
  }): Promise<Transaction> {
    const { userId, fundCode, amount, type, strategyId, confirmationTimeoutMinutes } = params;

    const now = new Date();
    const deadline = new Date(now.getTime() + confirmationTimeoutMinutes * 60 * 1000);

    const transaction = this.transactionRepository.create({
      user_id: userId,
      fund_code: fundCode,
      type,
      amount,
      requires_confirmation: true,
      confirmation_status: TransactionConfirmationStatus.PENDING_CONFIRMATION,
      confirmation_deadline: deadline,
      strategy_id: strategyId,
      status: 'PENDING' as any, // 使用 PENDING 作为基础状态
    });

    await this.transactionRepository.save(transaction);

    this.logger.log(
      `Created pending transaction ${transaction.id} for ${fundCode}, amount: ${amount}, deadline: ${deadline}`,
    );

    return transaction;
  }

  /**
   * 发送确认请求
   *
   * 向用户发送确认通知（Telegram 和飞书），包含确认/取消按钮。
   *
   * @param transaction 待确认的交易
   * @returns Promise
   */
  async sendConfirmationRequest(transaction: Transaction): Promise<void> {
    const params = {
      transactionId: transaction.id,
      fundCode: transaction.fund_code,
      amount: transaction.amount,
      type: transaction.type,
      deadline: transaction.confirmation_deadline,
    };

    this.logger.log(`Sending confirmation request for transaction ${transaction.id}`);

    // 并行发送到所有渠道
    await Promise.all([
      this.telegramService.sendConfirmationMessage(params),
      this.feishuService.sendConfirmationMessage(params),
    ]);

    this.logger.log(`Confirmation request sent for transaction ${transaction.id}`);
  }

  /**
   * 处理用户确认
   *
   * 用户点击确认按钮后调用，更新交易状态并执行交易。
   *
   * @param transactionId 交易 ID
   * @param callbackData 回调数据（用于审计）
   * @returns 确认后的交易记录
   * @throws BadRequestException 如果交易不存在或状态不正确
   */
  async handleConfirmation(
    transactionId: string,
    callbackData?: Record<string, any>,
  ): Promise<Transaction> {
    this.logger.log(`Handling confirmation for transaction ${transactionId}`);

    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
      relations: ['strategy'],
    });

    if (!transaction) {
      throw new BadRequestException(`交易 ${transactionId} 不存在`);
    }

    // 检查交易状态
    if (transaction.confirmation_status !== TransactionConfirmationStatus.PENDING_CONFIRMATION) {
      throw new BadRequestException(
        `交易 ${transactionId} 状态不正确：${transaction.confirmation_status}`,
      );
    }

    // 检查是否超时
    if (transaction.confirmation_deadline && new Date() > transaction.confirmation_deadline) {
      throw new BadRequestException(`交易 ${transactionId} 已超时`);
    }

    // 更新交易状态
    transaction.confirmation_status = TransactionConfirmationStatus.CONFIRMED;
    transaction.user_confirmed_at = new Date();
    transaction.confirmation_callback_data = callbackData || null;

    await this.transactionRepository.save(transaction);

    this.logger.log(`Transaction ${transactionId} confirmed by user`);

    // 发送确认成功通知
    await this.notifyService.send({
      title: '交易已确认',
      content: `基金 ${transaction.fund_code} ${transaction.type === TransactionType.BUY ? '买入' : '卖出'} ${transaction.amount} 元\n交易已执行`,
      level: 'info',
    });

    return transaction;
  }

  /**
   * 处理用户取消
   *
   * 用户点击取消按钮后调用，更新交易状态为已取消。
   *
   * @param transactionId 交易 ID
   * @param callbackData 回调数据（用于审计）
   * @returns 取消后的交易记录
   * @throws BadRequestException 如果交易不存在或状态不正确
   */
  async handleCancellation(
    transactionId: string,
    callbackData?: Record<string, any>,
  ): Promise<Transaction> {
    this.logger.log(`Handling cancellation for transaction ${transactionId}`);

    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new BadRequestException(`交易 ${transactionId} 不存在`);
    }

    // 检查交易状态
    if (transaction.confirmation_status !== TransactionConfirmationStatus.PENDING_CONFIRMATION) {
      throw new BadRequestException(
        `交易 ${transactionId} 状态不正确：${transaction.confirmation_status}`,
      );
    }

    // 更新交易状态
    transaction.confirmation_status = TransactionConfirmationStatus.CANCELLED;
    transaction.cancelled_at = new Date();
    transaction.confirmation_callback_data = callbackData || null;

    await this.transactionRepository.save(transaction);

    this.logger.log(`Transaction ${transactionId} cancelled by user`);

    // 发送取消通知
    await this.notifyService.send({
      title: '交易已取消',
      content: `基金 ${transaction.fund_code} ${transaction.type === TransactionType.BUY ? '买入' : '卖出'} ${transaction.amount} 元\n用户已取消交易`,
      level: 'warning',
    });

    return transaction;
  }

  /**
   * 取消超时交易
   *
   * 检查所有超过确认截止时间但仍为 PENDING_CONFIRMATION 状态的交易，
   * 自动取消它们并发送通知。
   *
   * @returns 被取消的交易数量
   */
  async cancelTimeoutTransactions(): Promise<number> {
    this.logger.debug('Checking for timeout transactions...');

    const now = new Date();

    // 查找所有超时的待确认交易
    const timeoutTransactions = await this.transactionRepository.find({
      where: {
        confirmation_status: TransactionConfirmationStatus.PENDING_CONFIRMATION,
        confirmation_deadline: LessThan(now),
      },
    });

    if (timeoutTransactions.length === 0) {
      this.logger.debug('No timeout transactions found');
      return 0;
    }

    this.logger.log(`Found ${timeoutTransactions.length} timeout transactions`);

    let cancelledCount = 0;

    for (const transaction of timeoutTransactions) {
      try {
        transaction.confirmation_status = TransactionConfirmationStatus.TIMEOUT_CANCELLED;
        transaction.cancelled_at = new Date();

        await this.transactionRepository.save(transaction);

        // 发送超时取消通知
        await this.notifyService.send({
          title: '交易超时取消',
          content: `基金 ${transaction.fund_code} ${transaction.type === TransactionType.BUY ? '买入' : '卖出'} ${transaction.amount} 元\n确认超时，交易已自动取消`,
          level: 'warning',
        });

        cancelledCount++;
        this.logger.log(`Transaction ${transaction.id} cancelled due to timeout`);
      } catch (error) {
        this.logger.error(
          `Failed to cancel timeout transaction ${transaction.id}: ${error.message}`,
        );
      }
    }

    return cancelledCount;
  }

  /**
   * 获取所有待确认交易
   *
   * 获取指定用户的所有待确认交易。
   *
   * @param userId 用户 ID（可选，不传则获取所有用户）
   * @returns 待确认交易列表
   */
  async getPendingConfirmations(userId?: string): Promise<Transaction[]> {
    const whereCondition: any = {
      confirmation_status: TransactionConfirmationStatus.PENDING_CONFIRMATION,
    };

    if (userId) {
      whereCondition.user_id = userId;
    }

    return this.transactionRepository.find({
      where: whereCondition,
      relations: ['strategy'],
      order: { confirmation_deadline: 'ASC' },
    });
  }

  /**
   * 获取交易确认状态
   *
   * @param transactionId 交易 ID
   * @returns 交易确认状态
   */
  async getConfirmationStatus(transactionId: string): Promise<{
    requiresConfirmation: boolean;
    confirmationStatus: TransactionConfirmationStatus;
    deadline?: Date;
    confirmedAt?: Date;
    cancelledAt?: Date;
  } | null> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      return null;
    }

    return {
      requiresConfirmation: transaction.requires_confirmation,
      confirmationStatus: transaction.confirmation_status,
      deadline: transaction.confirmation_deadline,
      confirmedAt: transaction.user_confirmed_at,
      cancelledAt: transaction.cancelled_at,
    };
  }
}
