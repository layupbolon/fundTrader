import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Fund } from './fund.entity';

/**
 * 基金净值实体
 *
 * 存储基金的历史净值数据，用于计算收益率、回测策略和分析基金表现。
 * 这是一个时序数据表，每天为每只基金记录一条净值记录。
 *
 * 数据特点：
 * - 时序数据：按日期顺序存储，适合使用 TimescaleDB 优化
 * - 高频查询：回测和收益计算需要频繁查询历史净值
 * - 唯一约束：同一基金同一日期只能有一条记录
 *
 * 数据来源：
 * - 从天天基金 API 获取每日净值
 * - 定时任务每天 09:00 自动同步
 */
@Entity('fund_navs')
@Index(['fund_code', 'date'], { unique: true })
export class FundNav {
  /**
   * 自增主键
   * 用于唯一标识每条净值记录
   */
  @PrimaryGeneratedColumn('increment')
  id: number;

  /**
   * 基金代码
   * 外键，关联到 funds 表
   */
  @Column()
  fund_code: string;

  /**
   * 基金关联
   * 多对一关系：多条净值记录对应一只基金
   */
  @ManyToOne(() => Fund)
  @JoinColumn({ name: 'fund_code' })
  fund: Fund;

  /**
   * 单位净值
   *
   * 每份基金的当前价值，精度到小数点后4位
   * 例如：1.2345 表示每份基金价值 1.2345 元
   *
   * 用途：
   * - 计算持仓市值：shares * nav
   * - 计算收益率：(nav - avg_price) / avg_price
   */
  @Column({ type: 'decimal', precision: 10, scale: 4 })
  nav: number;

  /**
   * 累计净值
   *
   * 考虑历史分红后的累计净值，精度到小数点后4位
   * 累计净值 = 单位净值 + 历史分红总和
   *
   * 用途：
   * - 评估基金长期表现
   * - 回测时考虑分红再投资
   */
  @Column({ type: 'decimal', precision: 10, scale: 4 })
  acc_nav: number;

  /**
   * 净值日期
   *
   * 该净值对应的交易日期
   * 注意：基金净值通常在交易日收盘后（晚上）更新
   */
  @Column({ type: 'date' })
  date: Date;

  /**
   * 日增长率
   *
   * 相对于前一交易日的涨跌幅，精度到小数点后4位
   * 例如：0.0123 表示上涨 1.23%，-0.0056 表示下跌 0.56%
   *
   * 计算公式：(今日净值 - 昨日净值) / 昨日净值
   *
   * 用途：
   * - 分析基金波动性
   * - 计算夏普比率等风险指标
   */
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  growth_rate: number;
}
