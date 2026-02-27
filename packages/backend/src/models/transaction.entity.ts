import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Fund } from './fund.entity';
import { Strategy } from './strategy.entity';
import { TransactionType, TransactionStatus } from './enums';

/**
 * 交易记录实体
 *
 * 存储所有基金交易记录，包括买入和卖出操作。
 * 记录交易的完整生命周期：提交 -> 待确认 -> 已确认/失败。
 *
 * 场外基金交易特性：
 * - T+1 确认机制：今天提交的交易，明天才能确认份额
 * - 交易时间限制：工作日 15:00 前提交，按当日净值成交
 * - 交易时间限制：工作日 15:00 后提交，按次日净值成交
 * - 净值未知：提交时不知道成交净值，确认后才知道实际份额
 *
 * 状态流转：
 * PENDING（待提交）-> SUBMITTED（已提交）-> CONFIRMED（已确认）
 *                                      -> FAILED（失败）
 *
 * 关联策略：
 * - 如果是策略自动执行的交易，会关联到对应的策略记录
 * - 手动交易不关联策略
 */
@Entity('transactions')
export class Transaction {
  /**
   * 交易唯一标识符
   * 使用 UUID 格式，自动生成
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 用户ID
   * 外键，关联到 users 表
   */
  @Column()
  user_id: string;

  /**
   * 用户关联
   * 多对一关系：一个用户可以有多笔交易
   */
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * 基金代码
   * 外键，关联到 funds 表
   */
  @Column()
  fund_code: string;

  /**
   * 基金关联
   * 多对一关系：一只基金可以有多笔交易
   */
  @ManyToOne(() => Fund)
  @JoinColumn({ name: 'fund_code' })
  fund: Fund;

  /**
   * 交易类型
   * - BUY: 买入
   * - SELL: 卖出
   */
  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  /**
   * 交易金额
   *
   * 买入：投入的金额（人民币），精度到小数点后2位
   * 卖出：卖出的份额对应的金额（确认后计算）
   *
   * 例如：1000.00 表示买入 1000 元或卖出获得 1000 元
   */
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  /**
   * 交易份额
   *
   * 确认后才有值，精度到小数点后4位
   * 买入：amount / 成交净值
   * 卖出：用户指定的卖出份额
   *
   * 注意：提交时为 null，确认后才更新
   */
  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true })
  shares: number;

  /**
   * 成交价格（净值）
   *
   * 确认后才有值，精度到小数点后4位
   * 表示实际成交时的基金净值
   *
   * 注意：提交时为 null，确认后才更新
   */
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  price: number;

  /**
   * 交易状态
   * - PENDING: 待提交（本地创建，未提交到交易平台）
   * - SUBMITTED: 已提交（已提交到交易平台，等待确认）
   * - CONFIRMED: 已确认（交易成功，份额已到账）
   * - FAILED: 失败（交易失败，如余额不足、超过限额等）
   */
  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.PENDING })
  status: TransactionStatus;

  /**
   * 交易平台订单号
   *
   * 提交到天天基金后返回的订单号
   * 用于查询订单状态和确认交易结果
   */
  @Column({ nullable: true })
  order_id: string;

  /**
   * 提交时间
   * 自动记录交易提交到系统的时间
   */
  @CreateDateColumn()
  submitted_at: Date;

  /**
   * 确认时间
   *
   * 交易确认的时间（T+1 日）
   * 只有状态为 CONFIRMED 或 FAILED 时才有值
   */
  @Column({ type: 'timestamp', nullable: true })
  confirmed_at: Date;

  /**
   * 确认份额
   * T+1 确认后的实际份额
   */
  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true })
  confirmed_shares: number;

  /**
   * 确认价格（净值）
   * T+1 确认后的实际成交净值
   */
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  confirmed_price: number;

  /**
   * 关联策略ID
   *
   * 如果是策略自动执行的交易，记录策略ID
   * 手动交易为 null
   *
   * 用途：
   * - 追踪策略执行情况
   * - 分析策略表现
   * - 回测验证
   */
  @Column({ nullable: true })
  strategy_id: string;

  /**
   * 策略关联
   * 多对一关系：一个策略可以执行多笔交易
   */
  @ManyToOne(() => Strategy, { nullable: true })
  @JoinColumn({ name: 'strategy_id' })
  strategy: Strategy;
}
