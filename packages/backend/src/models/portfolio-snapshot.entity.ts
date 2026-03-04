import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * 投资组合快照实体
 *
 * 每日记录用户的投资组合表现，用于收益分析和可视化。
 * 快照在每日 23:59 自动创建，记录当天的资产状况。
 *
 * 用途：
 * - 收益曲线分析
 * - 历史表现回溯
 * - 数据可视化展示
 */
@Entity('portfolio_snapshots')
export class PortfolioSnapshot {
  /**
   * 快照唯一标识符
   * 使用 UUID 格式，自动生成
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 用户 ID
   * 外键，关联到 users 表
   */
  @Column()
  user_id: string;

  /**
   * 用户关联
   * 多对一关系：一个用户可以有多个快照记录
   */
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * 总资产
   *
   * 当日总资产市值（人民币），精度到小数点后 2 位
   * 计算方式：所有持仓的 current_value 之和
   */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  total_assets: number;

  /**
   * 总盈亏
   *
   * 当日累计盈亏金额（人民币），精度到小数点后 2 位
   * 计算方式：总盈亏 = 总资产 - 总成本
   */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  total_profit: number;

  /**
   * 总收益率
   *
   * 当日累计收益率，精度到小数点后 4 位
   * 计算方式：总收益率 = 总盈亏 / 总成本
   *
   * 例如：0.1234 表示收益率 12.34%
   */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  total_profit_rate: number;

  /**
   * 总成本
   *
   * 累计投入的总成本（人民币），精度到小数点后 2 位
   * 用于计算收益率
   */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  total_cost: number;

  /**
   * 持仓数量
   *
   * 当日持有的基金数量
   */
  @Column({ default: 0 })
  position_count: number;

  /**
   * 快照日期
   *
   * 快照对应的日期（日期格式，不包含时间）
   * 用于收益曲线横坐标
   */
  @Column({ type: 'date' })
  snapshot_date: Date;

  /**
   * 创建时间
   * 自动记录快照创建的时间戳
   */
  @CreateDateColumn()
  created_at: Date;
}
