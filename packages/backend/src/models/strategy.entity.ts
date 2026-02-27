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
import { StrategyType } from './enums';

/**
 * 策略实体
 *
 * 存储用户配置的交易策略，包括定投策略和止盈止损策略。
 * 每个策略关联一个用户和一只基金，通过配置参数控制策略行为。
 *
 * 策略类型：
 * - AUTO_INVEST: 定投策略（按固定频率自动买入）
 * - TAKE_PROFIT_STOP_LOSS: 止盈止损策略（达到目标收益率自动卖出）
 *
 * 执行机制：
 * - 定时任务定期检查启用的策略
 * - 根据策略类型和配置参数判断是否触发交易
 * - 自动创建交易记录并提交到交易平台
 *
 * 策略状态：
 * - enabled = true: 策略启用，定时任务会执行
 * - enabled = false: 策略暂停，不会执行
 */
@Entity('strategies')
export class Strategy {
  /**
   * 策略唯一标识符
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
   * 多对一关系：一个用户可以配置多个策略
   */
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * 策略名称
   * 用户自定义的策略名称，便于识别和管理
   * 例如："沪深300定投"、"消费主题止盈"
   */
  @Column()
  name: string;

  /**
   * 策略类型
   * - AUTO_INVEST: 定投策略
   * - TAKE_PROFIT_STOP_LOSS: 止盈止损策略
   */
  @Column({ type: 'enum', enum: StrategyType })
  type: StrategyType;

  /**
   * 基金代码
   * 外键，关联到 funds 表
   * 该策略应用于哪只基金
   */
  @Column()
  fund_code: string;

  /**
   * 基金关联
   * 多对一关系：一只基金可以有多个策略
   */
  @ManyToOne(() => Fund)
  @JoinColumn({ name: 'fund_code' })
  fund: Fund;

  /**
   * 策略配置参数
   *
   * 根据策略类型存储不同的配置：
   *
   * 定投策略 (AUTO_INVEST):
   * {
   *   amount: number,           // 每次定投金额（元）
   *   frequency: 'daily' | 'weekly' | 'monthly',  // 定投频率
   *   dayOfWeek?: number,       // 周定投：星期几（1-7）
   *   dayOfMonth?: number       // 月定投：每月几号（1-31）
   * }
   *
   * 止盈止损策略 (TAKE_PROFIT_STOP_LOSS):
   * {
   *   takeProfitRate: number,   // 止盈收益率（如 0.20 表示 20%）
   *   stopLossRate: number,     // 止损收益率（如 -0.10 表示 -10%）
   *   trailingStopRate?: number,// 移动止盈回撤率（如 0.05 表示从最高点回撤 5% 时卖出）
   *   sellRatio: number         // 卖出比例（如 0.5 表示卖出 50% 仓位）
   * }
   */
  @Column({ type: 'jsonb' })
  config: any;

  /**
   * 策略启用状态
   * - true: 策略启用，定时任务会执行
   * - false: 策略暂停，不会执行
   *
   * 用途：
   * - 临时暂停策略而不删除配置
   * - 回测验证后再启用
   */
  @Column({ default: true })
  enabled: boolean;

  /**
   * 最后执行时间
   * 记录策略最后一次成功执行的时间，用于去重防护
   * 防止同一天内重复执行定投操作
   */
  @Column({ type: 'timestamp', nullable: true })
  last_executed_at: Date;

  /**
   * 创建时间
   * 自动记录策略创建时间
   */
  @CreateDateColumn()
  created_at: Date;
}
