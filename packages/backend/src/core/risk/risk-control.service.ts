import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { RiskLimit, RiskLimitType, Blacklist, BlacklistType } from '../../models';
import { Position, Transaction, TransactionType, TransactionStatus } from '../../models';

/**
 * 风控检查结果接口
 */
export interface RiskCheckResult {
  /** 是否通过检查 */
  passed: boolean;
  /** 未通过时的错误消息 */
  message?: string;
  /** 未通过时的错误代码 */
  code?: string;
}

/**
 * 单日交易统计接口
 */
export interface DailyTradeStats {
  /** 单日累计交易金额 */
  totalAmount: number;
  /** 单日交易次数 */
  count: number;
}

/**
 * 持仓统计接口
 */
export interface PositionStats {
  /** 总资产 */
  totalAssets: number;
  /** 单只基金持仓金额 */
  fundPosition: number;
  /** 持仓比例 */
  positionRatio: number;
}

/**
 * 风控控制服务
 *
 * 提供全面的风险控制检查功能，包括：
 * - 单日交易限额检查
 * - 单笔交易限额检查
 * - 单日交易次数限制检查
 * - 持仓比例限制检查
 * - 基金黑名单检查
 * - 异常检测与自动暂停
 *
 * 使用方式：
 * 1. 交易前调用 checkTradeLimit() 检查交易限额
 * 2. 创建策略前调用 checkFundBlacklist() 检查基金是否在黑名单
 * 3. 定期检查持仓比例和最大回撤
 *
 * 风控配置通过 RiskLimit 实体管理，支持动态配置和启停控制。
 */
@Injectable()
export class RiskControlService {
  private readonly logger = new Logger(RiskControlService.name);

  constructor(
    @InjectRepository(RiskLimit)
    private readonly riskLimitRepository: Repository<RiskLimit>,
    @InjectRepository(Blacklist)
    private readonly blacklistRepository: Repository<Blacklist>,
    @InjectRepository(Position)
    private readonly positionRepository: Repository<Position>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  /**
   * 检查交易限额
   *
   * 在创建交易订单前调用，检查是否超过各类限额。
   * 检查项目：
   * - 单日交易限额（DAILY_TRADE_LIMIT）
   * - 单笔交易限额（SINGLE_TRADE_LIMIT）
   * - 单日交易次数限制（DAILY_TRADE_COUNT_LIMIT）
   *
   * @param userId 用户 ID
   * @param amount 交易金额
   * @param type 交易类型（BUY/SELL）
   * @returns 风控检查结果
   *
   * @example
   * const result = await riskControlService.checkTradeLimit('user123', 10000, TransactionType.BUY);
   * if (!result.passed) {
   *   throw new BadRequestException(result.message);
   * }
   */
  async checkTradeLimit(
    userId: string,
    amount: number,
    type: TransactionType,
  ): Promise<RiskCheckResult> {
    this.logger.debug(`Checking trade limit for user ${userId}, amount: ${amount}, type: ${type}`);

    // 获取所有启用的限额配置
    const limits = await this.riskLimitRepository.find({
      where: { user_id: userId, enabled: true },
    });

    // 1. 检查单笔交易限额
    const singleTradeLimit = limits.find((l) => l.type === RiskLimitType.SINGLE_TRADE_LIMIT);
    if (singleTradeLimit && amount > singleTradeLimit.limit_value) {
      const message = `单笔交易金额 ${amount} 元超过限额 ${singleTradeLimit.limit_value} 元`;
      this.logger.warn(message);
      return {
        passed: false,
        message,
        code: 'SINGLE_TRADE_LIMIT_EXCEEDED',
      };
    }

    // 2. 获取今日交易统计
    const todayStats = await this.getTodayTradeStats(userId);

    // 3. 检查单日交易限额
    const dailyTradeLimit = limits.find((l) => l.type === RiskLimitType.DAILY_TRADE_LIMIT);
    if (dailyTradeLimit) {
      const newTotal = todayStats.totalAmount + amount;
      if (newTotal > dailyTradeLimit.limit_value) {
        const message = `单日累计交易金额 ${newTotal} 元超过限额 ${dailyTradeLimit.limit_value} 元（已使用 ${todayStats.totalAmount} 元）`;
        this.logger.warn(message);
        return {
          passed: false,
          message,
          code: 'DAILY_TRADE_LIMIT_EXCEEDED',
        };
      }
    }

    // 4. 检查单日交易次数限制
    const dailyTradeCountLimit = limits.find(
      (l) => l.type === RiskLimitType.DAILY_TRADE_COUNT_LIMIT,
    );
    if (dailyTradeCountLimit) {
      const newCount = todayStats.count + 1;
      if (newCount > dailyTradeCountLimit.limit_value) {
        const message = `单日交易次数 ${newCount} 次超过限额 ${dailyTradeCountLimit.limit_value} 次（已使用 ${todayStats.count} 次）`;
        this.logger.warn(message);
        return {
          passed: false,
          message,
          code: 'DAILY_TRADE_COUNT_LIMIT_EXCEEDED',
        };
      }
    }

    this.logger.debug('Trade limit check passed');
    return { passed: true };
  }

  /**
   * 检查持仓比例限制
   *
   * 在创建买入交易前调用，检查买入后是否超过持仓比例限制。
   *
   * @param userId 用户 ID
   * @param fundCode 基金代码
   * @param amount 买入金额
   * @returns 风控检查结果
   *
   * @example
   * const result = await riskControlService.checkPositionLimit('user123', '000001', 50000);
   * if (!result.passed) {
   *   throw new BadRequestException(result.message);
   * }
   */
  async checkPositionLimit(
    userId: string,
    fundCode: string,
    amount: number,
  ): Promise<RiskCheckResult> {
    this.logger.debug(
      `Checking position limit for user ${userId}, fund: ${fundCode}, amount: ${amount}`,
    );

    // 获取持仓比例限制配置
    const positionLimit = await this.riskLimitRepository.findOne({
      where: { user_id: userId, type: RiskLimitType.POSITION_RATIO_LIMIT, enabled: true },
    });

    if (!positionLimit) {
      // 没有配置持仓比例限制，直接通过
      return { passed: true };
    }

    // 获取用户总持仓和该基金持仓
    const positionStats = await this.getPositionStats(userId, fundCode);

    // 计算买入后的持仓比例
    const newPositionValue = positionStats.fundPosition + amount;
    const newPositionRatio = newPositionValue / positionStats.totalAssets;

    if (newPositionRatio > positionLimit.limit_value) {
      const message = `基金 ${fundCode} 持仓比例 ${Math.round(newPositionRatio * 100)}% 超过限额 ${Math.round(positionLimit.limit_value * 100)}%`;
      this.logger.warn(message);
      return {
        passed: false,
        message,
        code: 'POSITION_RATIO_LIMIT_EXCEEDED',
      };
    }

    this.logger.debug('Position limit check passed');
    return { passed: true };
  }

  /**
   * 检查基金是否在黑名单中
   *
   * 在创建策略或交易前调用，检查基金是否被禁止交易。
   *
   * @param fundCode 基金代码
   * @param fundManager 基金经理姓名（可选）
   * @param fundCompany 基金公司名称（可选）
   * @returns 风控检查结果
   *
   * @example
   * const result = await riskControlService.checkFundBlacklist('000001');
   * if (!result.passed) {
   *   throw new BadRequestException(result.message);
   * }
   */
  async checkFundBlacklist(
    fundCode: string,
    fundManager?: string,
    fundCompany?: string,
  ): Promise<RiskCheckResult> {
    this.logger.debug(`Checking fund blacklist for fund: ${fundCode}`);

    // 获取所有启用的黑名单记录
    const blacklistItems = await this.blacklistRepository.find({
      where: { enabled: true },
    });

    // 过滤掉已过期的记录
    const now = new Date();
    const validBlacklistItems = blacklistItems.filter(
      (item) => !item.expires_at || item.expires_at > now,
    );

    // 检查基金代码
    const fundCodeBlacklist = validBlacklistItems.find(
      (item) => item.type === BlacklistType.FUND_CODE && item.value === fundCode,
    );
    if (fundCodeBlacklist) {
      const message = `基金 ${fundCode} 在黑名单中（原因：${fundCodeBlacklist.reason}）`;
      this.logger.warn(message);
      return {
        passed: false,
        message,
        code: 'FUND_IN_BLACKLIST',
      };
    }

    // 检查基金经理
    if (fundManager) {
      const managerBlacklist = validBlacklistItems.find(
        (item) => item.type === BlacklistType.FUND_MANAGER && item.value === fundManager,
      );
      if (managerBlacklist) {
        const message = `基金经理 ${fundManager} 在黑名单中（原因：${managerBlacklist.reason}）`;
        this.logger.warn(message);
        return {
          passed: false,
          message,
          code: 'MANAGER_IN_BLACKLIST',
        };
      }
    }

    // 检查基金公司
    if (fundCompany) {
      const companyBlacklist = validBlacklistItems.find(
        (item) => item.type === BlacklistType.FUND_COMPANY && item.value === fundCompany,
      );
      if (companyBlacklist) {
        const message = `基金公司 ${fundCompany} 在黑名单中（原因：${companyBlacklist.reason}）`;
        this.logger.warn(message);
        return {
          passed: false,
          message,
          code: 'COMPANY_IN_BLACKLIST',
        };
      }
    }

    this.logger.debug('Fund blacklist check passed');
    return { passed: true };
  }

  /**
   * 检查最大回撤
   *
   * 定期检查用户资产是否触及最大回撤限制。
   *
   * @param userId 用户 ID
   * @param currentAssets 当前总资产
   * @param peakAssets 历史最高资产（需要外部传入）
   * @returns 风控检查结果
   *
   * @example
   * const result = await riskControlService.checkMaxDrawdown('user123', 80000, 100000);
   * if (!result.passed) {
   *   // 暂停所有策略
   *   await strategyService.pauseAllStrategies('user123');
   * }
   */
  async checkMaxDrawdown(
    userId: string,
    currentAssets: number,
    peakAssets: number,
  ): Promise<RiskCheckResult> {
    this.logger.debug(
      `Checking max drawdown for user ${userId}, current: ${currentAssets}, peak: ${peakAssets}`,
    );

    // 获取最大回撤限制配置
    const maxDrawdownLimit = await this.riskLimitRepository.findOne({
      where: { user_id: userId, type: RiskLimitType.MAX_DRAWDOWN_LIMIT, enabled: true },
    });

    if (!maxDrawdownLimit) {
      // 没有配置最大回撤限制，直接通过
      return { passed: true };
    }

    // 计算当前回撤
    const drawdown = (peakAssets - currentAssets) / peakAssets;

    if (drawdown > maxDrawdownLimit.limit_value) {
      const message = `当前回撤 ${Math.round(drawdown * 100)}% 超过最大回撤限制 ${Math.round(maxDrawdownLimit.limit_value * 100)}%`;
      this.logger.warn(message);
      return {
        passed: false,
        message,
        code: 'MAX_DRAWDOWN_EXCEEDED',
      };
    }

    this.logger.debug('Max drawdown check passed');
    return { passed: true };
  }

  /**
   * 检查总资产止损线
   *
   * 定期检查用户总资产是否触及止损线。
   *
   * @param userId 用户 ID
   * @param currentAssets 当前总资产
   * @returns 风控检查结果
   *
   * @example
   * const result = await riskControlService.checkTotalAssetStopLoss('user123', 45000);
   * if (!result.passed) {
   *   // 暂停所有策略
   *   await strategyService.pauseAllStrategies('user123');
   * }
   */
  async checkTotalAssetStopLoss(userId: string, currentAssets: number): Promise<RiskCheckResult> {
    this.logger.debug(
      `Checking total asset stop loss for user ${userId}, current: ${currentAssets}`,
    );

    // 获取总资产止损线配置
    const totalAssetStopLoss = await this.riskLimitRepository.findOne({
      where: { user_id: userId, type: RiskLimitType.TOTAL_ASSET_STOP_LOSS, enabled: true },
    });

    if (!totalAssetStopLoss) {
      // 没有配置止损线，直接通过
      return { passed: true };
    }

    if (currentAssets < totalAssetStopLoss.limit_value) {
      const message = `当前总资产 ${currentAssets} 元低于止损线 ${totalAssetStopLoss.limit_value} 元`;
      this.logger.warn(message);
      return {
        passed: false,
        message,
        code: 'TOTAL_ASSET_STOP_LOSS_TRIGGERED',
      };
    }

    this.logger.debug('Total asset stop loss check passed');
    return { passed: true };
  }

  /**
   * 获取今日交易统计
   *
   * @param userId 用户 ID
   * @returns 今日交易统计信息
   */
  async getTodayTradeStats(userId: string): Promise<DailyTradeStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'totalAmount')
      .addSelect('COUNT(transaction.id)', 'count')
      .where('transaction.user_id = :userId', { userId })
      .andWhere('transaction.submitted_at >= :today', { today })
      .andWhere('transaction.submitted_at < :tomorrow', { tomorrow })
      .andWhere('transaction.status IN (:...statuses)', {
        statuses: [TransactionStatus.SUBMITTED, TransactionStatus.CONFIRMED],
      })
      .getRawOne();

    return {
      totalAmount: parseFloat(result?.totalAmount || '0'),
      count: parseInt(result?.count || '0', 10),
    };
  }

  /**
   * 获取持仓统计
   *
   * @param userId 用户 ID
   * @param fundCode 指定基金代码（可选）
   * @returns 持仓统计信息
   */
  async getPositionStats(userId: string, fundCode?: string): Promise<PositionStats> {
    // 获取所有持仓
    const positions = await this.positionRepository.find({
      where: { user_id: userId },
    });

    // 计算总资产
    const totalAssets = positions.reduce((sum, pos) => sum + Number(pos.current_value || 0), 0);

    // 计算指定基金持仓
    let fundPosition = 0;
    if (fundCode) {
      const fundPositionData = positions.find((pos) => pos.fund_code === fundCode);
      fundPosition = Number(fundPositionData?.current_value || 0);
    }

    // 计算持仓比例
    const positionRatio = totalAssets > 0 ? fundPosition / totalAssets : 0;

    return {
      totalAssets,
      fundPosition,
      positionRatio,
    };
  }

  /**
   * 重置单日交易统计
   *
   * 每天 00:00 调用，重置所有用户的单日交易累计值。
   * 应该由定时任务自动执行。
   *
   * @param userId 用户 ID（可选，不传则重置所有用户）
   */
  async resetDailyTradeStats(userId?: string): Promise<void> {
    this.logger.debug(`Resetting daily trade stats for user: ${userId || 'all'}`);

    const whereCondition: any = { type: RiskLimitType.DAILY_TRADE_LIMIT };
    if (userId) {
      whereCondition.user_id = userId;
    }

    await this.riskLimitRepository.update(whereCondition, {
      current_usage: 0,
    });

    this.logger.debug('Daily trade stats reset completed');
  }

  /**
   * 更新交易累计
   *
   * 交易成功后调用，更新单日交易累计值。
   *
   * @param userId 用户 ID
   * @param amount 交易金额
   */
  async updateTradeUsage(userId: string, amount: number): Promise<void> {
    this.logger.debug(`Updating trade usage for user ${userId}, amount: ${amount}`);

    const dailyLimit = await this.riskLimitRepository.findOne({
      where: { user_id: userId, type: RiskLimitType.DAILY_TRADE_LIMIT, enabled: true },
    });

    if (dailyLimit) {
      const newUsage = (dailyLimit.current_usage || 0) + amount;
      await this.riskLimitRepository.update(dailyLimit.id, {
        current_usage: newUsage,
      });
    }
  }
}
