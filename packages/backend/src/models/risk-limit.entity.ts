import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { RiskLimitType } from './enums';

/**
 * 风控限额实体
 *
 * 存储用户的风险控制配置，包括交易限额、持仓限制、止损线等。
 * 用于在交易前进行风控检查，防止重大损失。
 *
 * 风控类型：
 * - DAILY_TRADE_LIMIT: 单日累计交易金额上限
 * - SINGLE_TRADE_LIMIT: 单笔交易金额上限
 * - DAILY_TRADE_COUNT_LIMIT: 单日交易次数上限
 * - POSITION_RATIO_LIMIT: 单只基金持仓占总资产比例上限
 * - MAX_DRAWDOWN_LIMIT: 允许的最大回撤比例
 * - TOTAL_ASSET_STOP_LOSS: 总资产止损线
 *
 * 检查机制：
 * - 交易前检查：创建交易订单前进行限额检查
 * - 持仓检查：创建持仓前检查持仓比例
 * - 止损检查：定期检查总资产是否触及止损线
 *
 * 状态：
 * - enabled = true: 限额启用，交易前会检查
 * - enabled = false: 限额暂停，不会检查
 *
 * 触发动作：
 * - 超过限额：拒绝交易
 * - 触及止损线：暂停所有策略
 */
@Entity('risk_limits')
export class RiskLimit {
  /**
   * 风控限额唯一标识符
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
   * 多对一关系：一个用户可以配置多个风控限额
   */
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * 风控限额类型
   * - DAILY_TRADE_LIMIT: 单日交易限额
   * - SINGLE_TRADE_LIMIT: 单笔交易限额
   * - DAILY_TRADE_COUNT_LIMIT: 单日交易次数限制
   * - POSITION_RATIO_LIMIT: 持仓比例限制
   * - MAX_DRAWDOWN_LIMIT: 最大回撤限制
   * - TOTAL_ASSET_STOP_LOSS: 总资产止损线
   */
  @Column({ type: 'enum', enum: RiskLimitType })
  type: RiskLimitType;

  /**
   * 限额值
   *
   * 根据类型不同含义不同：
   * - 金额类型（DAILY_TRADE_LIMIT, SINGLE_TRADE_LIMIT）：人民币元
   * - 次数类型（DAILY_TRADE_COUNT_LIMIT）：交易次数
   * - 比例类型（POSITION_RATIO_LIMIT, MAX_DRAWDOWN_LIMIT）：小数，如 0.20 表示 20%
   * - 止损线（TOTAL_ASSET_STOP_LOSS）：人民币元
   */
  @Column({ type: 'decimal', precision: 20, scale: 4 })
  limit_value: number;

  /**
   * 限额启用状态
   * - true: 限额启用，交易前会检查
   * - false: 限额暂停，不会检查
   *
   * 用途：
   * - 临时暂停限额而不删除配置
   * - 根据市场情况灵活调整
   */
  @Column({ default: true })
  enabled: boolean;

  /**
   * 限额描述
   * 用户自定义的描述信息，便于识别
   * 例如："单日最大买入金额"、"单只基金最大持仓比例"
   */
  @Column({ nullable: true })
  description: string;

  /**
   * 当前周期已使用值
   *
   * 用于累计类型限额（如单日交易限额）：
   * - 每日 00:00 自动重置为 0
   * - 每次交易后更新
   *
   * 对于非累计类型限额（如单笔限额），此字段为 null
   */
  @Column({ type: 'decimal', precision: 20, scale: 4, nullable: true })
  current_usage: number;

  /**
   * 最后更新时间
   * 自动记录配置最后修改时间
   */
  @UpdateDateColumn()
  updated_at: Date;

  /**
   * 创建时间
   * 自动记录配置创建时间
   */
  @CreateDateColumn()
  created_at: Date;

  /**
   * 是否超过限额
   *
   * @param value 要检查的值
   * @returns true 表示超过限额，false 表示未超过
   */
  isExceeded(value: number): boolean {
    if (!this.enabled) {
      return false;
    }
    return value > this.limit_value;
  }

  /**
   * 获取剩余可用额度
   *
   * @returns 剩余额度，null 表示不适用
   */
  getRemaining(): number | null {
    if (!this.enabled || this.current_usage === null) {
      return null;
    }
    return Math.max(0, this.limit_value - this.current_usage);
  }
}
