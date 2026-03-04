import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PortfolioSnapshot } from '../../models';
import { Position, Transaction, TransactionType, TransactionStatus } from '../../models';

/**
 * 收益数据接口
 */
export interface ReturnsData {
  /** 日期 */
  date: string;
  /** 总资产 */
  total_assets: number;
  /** 总盈亏 */
  total_profit: number;
  /** 总收益率 */
  total_profit_rate: number;
  /** 持仓数量 */
  position_count: number;
}

/**
 * 持仓分析接口
 */
export interface PositionAnalysis {
  /** 基金代码 */
  fund_code: string;
  /** 基金名称 */
  fund_name: string;
  /** 持仓市值 */
  current_value: number;
  /** 持仓占比 */
  position_ratio: number;
  /** 盈亏金额 */
  profit: number;
  /** 盈亏率 */
  profit_rate: number;
}

/**
 * 交易统计接口
 */
export interface TransactionStats {
  /** 交易类型 */
  type: TransactionType;
  /** 交易次数 */
  count: number;
  /** 交易总金额 */
  total_amount: number;
  /** 成功次数 */
  success_count: number;
  /** 失败次数 */
  failed_count: number;
}

/**
 * 分析服务
 *
 * 提供投资组合分析功能，包括：
 * - 收益分析：获取历史收益数据，生成收益曲线
 * - 持仓分析：分析当前持仓分布情况
 * - 交易统计：统计交易记录和成功率
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(PortfolioSnapshot)
    private readonly portfolioSnapshotRepository: Repository<PortfolioSnapshot>,
    @InjectRepository(Position)
    private readonly positionRepository: Repository<Position>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  /**
   * 获取收益分析数据
   *
   * 返回指定时间段内的收益数据，用于绘制收益曲线。
   *
   * @param userId 用户 ID
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @returns 收益数据列表
   *
   * @example
   * const data = await analyticsService.getReturnsData(
   *   'user123',
   *   '2026-01-01',
   *   '2026-03-04'
   * );
   */
  async getReturnsData(userId: string, startDate: string, endDate: string): Promise<ReturnsData[]> {
    this.logger.debug(`Getting returns data for user ${userId} from ${startDate} to ${endDate}`);

    const snapshots = await this.portfolioSnapshotRepository.find({
      where: {
        user_id: userId,
        snapshot_date: Between(new Date(startDate), new Date(endDate)),
      },
      order: {
        snapshot_date: 'ASC',
      },
    });

    return snapshots.map((snapshot) => ({
      date: snapshot.snapshot_date.toISOString().split('T')[0],
      total_assets: Number(snapshot.total_assets),
      total_profit: Number(snapshot.total_profit),
      total_profit_rate: Number(snapshot.total_profit_rate),
      position_count: snapshot.position_count,
    }));
  }

  /**
   * 获取持仓分析数据
   *
   * 分析当前持仓分布情况，包括各基金的持仓占比和收益情况。
   *
   * @param userId 用户 ID
   * @returns 持仓分析数据
   *
   * @example
   * const analysis = await analyticsService.getPositionAnalysis('user123');
   */
  async getPositionAnalysis(userId: string): Promise<PositionAnalysis[]> {
    this.logger.debug(`Getting position analysis for user ${userId}`);

    const positions = await this.positionRepository
      .createQueryBuilder('position')
      .innerJoinAndSelect('position.fund', 'fund')
      .where('position.user_id = :userId', { userId })
      .andWhere('position.shares > 0')
      .orderBy('position.current_value', 'DESC')
      .getMany();

    // 计算总资产用于计算占比
    const totalAssets = positions.reduce((sum, pos) => sum + Number(pos.current_value || 0), 0);

    return positions.map((position) => ({
      fund_code: position.fund_code,
      fund_name: position.fund?.name || 'Unknown',
      current_value: Number(position.current_value),
      position_ratio: totalAssets > 0 ? Number(position.current_value) / totalAssets : 0,
      profit: Number(position.profit),
      profit_rate: Number(position.profit_rate),
    }));
  }

  /**
   * 获取交易统计数据
   *
   * 统计指定时间段内的交易情况，包括买入和卖出的次数、金额和成功率。
   *
   * @param userId 用户 ID
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @returns 交易统计数据
   *
   * @example
   * const stats = await analyticsService.getTransactionStats(
   *   'user123',
   *   '2026-01-01',
   *   '2026-03-04'
   * );
   */
  async getTransactionStats(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<TransactionStats[]> {
    this.logger.debug(
      `Getting transaction stats for user ${userId} from ${startDate} to ${endDate}`,
    );

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    endDateObj.setDate(endDateObj.getDate() + 1); // Include end date

    // 统计买入交易
    const buyStats = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('COUNT(CASE WHEN status = :confirmed THEN 1 END)', 'success_count')
      .addSelect('COUNT(CASE WHEN status = :failed THEN 1 END)', 'failed_count')
      .addSelect('COUNT(*)', 'total_count')
      .addSelect('SUM(amount)', 'total_amount')
      .where('transaction.user_id = :userId', { userId })
      .andWhere('transaction.type = :type', { type: TransactionType.BUY })
      .andWhere('transaction.submitted_at >= :startDate', { startDate: startDateObj })
      .andWhere('transaction.submitted_at < :endDate', { endDate: endDateObj })
      .setParameter('confirmed', TransactionStatus.CONFIRMED)
      .setParameter('failed', TransactionStatus.FAILED)
      .getRawOne();

    // 统计卖出交易
    const sellStats = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('COUNT(CASE WHEN status = :confirmed THEN 1 END)', 'success_count')
      .addSelect('COUNT(CASE WHEN status = :failed THEN 1 END)', 'failed_count')
      .addSelect('COUNT(*)', 'total_count')
      .addSelect('SUM(amount)', 'total_amount')
      .where('transaction.user_id = :userId', { userId })
      .andWhere('transaction.type = :type', { type: TransactionType.SELL })
      .andWhere('transaction.submitted_at >= :startDate', { startDate: startDateObj })
      .andWhere('transaction.submitted_at < :endDate', { endDate: endDateObj })
      .setParameter('confirmed', TransactionStatus.CONFIRMED)
      .setParameter('failed', TransactionStatus.FAILED)
      .getRawOne();

    return [
      {
        type: TransactionType.BUY,
        count: parseInt(buyStats?.total_count || '0', 10),
        total_amount: parseFloat(buyStats?.total_amount || '0'),
        success_count: parseInt(buyStats?.success_count || '0', 10),
        failed_count: parseInt(buyStats?.failed_count || '0', 10),
      },
      {
        type: TransactionType.SELL,
        count: parseInt(sellStats?.total_count || '0', 10),
        total_amount: parseFloat(sellStats?.total_amount || '0'),
        success_count: parseInt(sellStats?.success_count || '0', 10),
        failed_count: parseInt(sellStats?.failed_count || '0', 10),
      },
    ];
  }

  /**
   * 创建资产快照
   *
   * 为指定用户创建当前资产快照，记录在每日 23:59 执行。
   *
   * @param userId 用户 ID
   * @returns 创建的快照
   *
   * @example
   * await analyticsService.createSnapshot('user123');
   */
  async createSnapshot(userId: string): Promise<PortfolioSnapshot> {
    this.logger.debug(`Creating portfolio snapshot for user ${userId}`);

    // 获取当前持仓
    const positions = await this.positionRepository.find({
      where: { user_id: userId },
    });

    // 计算总资产、总成本、总盈亏
    const totalAssets = positions.reduce((sum, pos) => sum + Number(pos.current_value || 0), 0);

    const totalCost = positions.reduce((sum, pos) => sum + Number(pos.cost || 0), 0);

    const totalProfit = totalAssets - totalCost;

    const totalProfitRate = totalCost > 0 ? totalProfit / totalCost : 0;

    const positionCount = positions.filter((pos) => Number(pos.shares || 0) > 0).length;

    // 创建快照
    const snapshot = this.portfolioSnapshotRepository.create({
      user_id: userId,
      total_assets: totalAssets,
      total_profit: totalProfit,
      total_profit_rate: totalProfitRate,
      total_cost: totalCost,
      position_count: positionCount,
      snapshot_date: new Date(),
    });

    return this.portfolioSnapshotRepository.save(snapshot);
  }

  /**
   * 获取最新快照
   *
   * 获取用户的最新资产快照。
   *
   * @param userId 用户 ID
   * @returns 最新快照，如果没有快照则返回 null
   */
  async getLatestSnapshot(userId: string): Promise<PortfolioSnapshot | null> {
    return this.portfolioSnapshotRepository.findOne({
      where: { user_id: userId },
      order: { snapshot_date: 'DESC' },
    });
  }
}
