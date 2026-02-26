import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Fund } from './fund.entity';

/**
 * 持仓实体
 *
 * 存储用户的基金持仓信息，包括份额、成本、当前市值和收益情况。
 * 每个用户对每只基金只有一条持仓记录，通过交易记录更新持仓数据。
 *
 * 更新时机：
 * - 买入确认后：增加份额和成本，重新计算平均成本
 * - 卖出确认后：减少份额和成本，保持平均成本不变
 * - 净值更新后：重新计算当前市值和收益率
 *
 * 业务规则：
 * - 场外基金 T+1 确认：今天买入，明天确认份额
 * - 平均成本计算：cost / shares
 * - 收益率计算：(current_value - cost) / cost
 */
@Entity('positions')
export class Position {
  /**
   * 持仓唯一标识符
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
   * 多对一关系：一个用户可以有多个持仓
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
   * 多对一关系：一只基金可以被多个用户持有
   */
  @ManyToOne(() => Fund)
  @JoinColumn({ name: 'fund_code' })
  fund: Fund;

  /**
   * 持有份额
   *
   * 当前持有的基金份额，精度到小数点后4位
   * 例如：1000.5000 表示持有 1000.5 份
   *
   * 更新规则：
   * - 买入确认：shares += 买入份额
   * - 卖出确认：shares -= 卖出份额
   */
  @Column({ type: 'decimal', precision: 15, scale: 4, default: 0 })
  shares: number;

  /**
   * 持仓成本
   *
   * 买入该基金的总成本（人民币），精度到小数点后2位
   * 例如：10000.00 表示总成本 10000 元
   *
   * 更新规则：
   * - 买入确认：cost += 买入金额
   * - 卖出确认：cost -= 卖出份额 * avg_price
   */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  cost: number;

  /**
   * 平均成本价
   *
   * 每份基金的平均买入价格，精度到小数点后4位
   * 计算公式：cost / shares
   *
   * 用途：
   * - 计算收益率
   * - 卖出时计算实际成本
   * - 止盈止损策略判断
   */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  avg_price: number;

  /**
   * 当前市值
   *
   * 按最新净值计算的持仓市值（人民币），精度到小数点后2位
   * 计算公式：shares * 最新净值
   *
   * 更新时机：
   * - 每天净值更新后重新计算
   * - 买入/卖出确认后重新计算
   */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  current_value: number;

  /**
   * 浮动盈亏
   *
   * 当前盈亏金额（人民币），精度到小数点后2位
   * 计算公式：current_value - cost
   *
   * 正数表示盈利，负数表示亏损
   */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  profit: number;

  /**
   * 收益率
   *
   * 当前收益率，精度到小数点后4位
   * 计算公式：profit / cost
   *
   * 例如：0.1234 表示收益率 12.34%
   *
   * 用途：
   * - 止盈止损策略判断
   * - 持仓表现分析
   * - 策略回测验证
   */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  profit_rate: number;

  /**
   * 最后更新时间
   * 自动记录持仓信息的最后更新时间
   */
  @UpdateDateColumn()
  updated_at: Date;
}
