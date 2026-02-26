import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

/**
 * 回测结果实体
 *
 * 存储策略回测的结果数据，用于评估策略在历史数据上的表现。
 * 回测通过历史净值数据模拟策略执行，计算收益率、风险指标等。
 *
 * 回测流程：
 * 1. 选择策略配置和回测时间范围
 * 2. 加载历史净值数据
 * 3. 按时间顺序模拟策略执行
 * 4. 计算性能指标（收益率、夏普比率、最大回撤）
 * 5. 保存回测结果
 *
 * 用途：
 * - 验证策略有效性
 * - 优化策略参数
 * - 对比不同策略表现
 * - 评估风险收益特征
 */
@Entity('backtest_results')
export class BacktestResult {
  /**
   * 回测结果唯一标识符
   * 使用 UUID 格式，自动生成
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 策略配置
   *
   * 存储回测使用的策略配置参数（JSON 格式）
   * 格式与 Strategy.config 相同，包含策略类型和参数
   *
   * 用途：
   * - 记录回测使用的具体参数
   * - 对比不同参数的回测结果
   * - 复现回测过程
   */
  @Column({ type: 'jsonb' })
  strategy_config: any;

  /**
   * 基金代码
   * 回测应用的基金
   */
  @Column()
  fund_code: string;

  /**
   * 回测开始日期
   * 回测数据的起始日期
   */
  @Column({ type: 'date' })
  start_date: Date;

  /**
   * 回测结束日期
   * 回测数据的结束日期
   */
  @Column({ type: 'date' })
  end_date: Date;

  /**
   * 初始资金
   *
   * 回测开始时的初始投入金额（人民币），精度到小数点后2位
   * 例如：10000.00 表示初始投入 10000 元
   */
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  initial_capital: number;

  /**
   * 最终市值
   *
   * 回测结束时的总资产价值（人民币），精度到小数点后2位
   * 包括持仓市值和剩余现金
   */
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  final_value: number;

  /**
   * 总收益率
   *
   * 回测期间的累计收益率，精度到小数点后4位
   * 计算公式：(final_value - initial_capital) / initial_capital
   *
   * 例如：0.3456 表示收益率 34.56%
   */
  @Column({ type: 'decimal', precision: 10, scale: 4 })
  total_return: number;

  /**
   * 年化收益率
   *
   * 将总收益率转换为年化收益率，精度到小数点后4位
   * 计算公式：(1 + total_return) ^ (365 / 回测天数) - 1
   *
   * 用途：
   * - 对比不同时间长度的回测结果
   * - 评估策略长期表现
   */
  @Column({ type: 'decimal', precision: 10, scale: 4 })
  annual_return: number;

  /**
   * 最大回撤
   *
   * 回测期间从最高点到最低点的最大跌幅，精度到小数点后4位
   * 计算公式：(最低点市值 - 最高点市值) / 最高点市值
   *
   * 例如：-0.2345 表示最大回撤 23.45%
   *
   * 用途：
   * - 评估策略风险
   * - 衡量策略稳定性
   * - 设置止损参数参考
   */
  @Column({ type: 'decimal', precision: 10, scale: 4 })
  max_drawdown: number;

  /**
   * 夏普比率
   *
   * 风险调整后的收益率指标，精度到小数点后4位
   * 计算公式：(年化收益率 - 无风险利率) / 收益率标准差
   *
   * 解读：
   * - > 1: 较好的风险收益比
   * - > 2: 优秀的风险收益比
   * - < 0: 收益低于无风险利率
   *
   * 用途：
   * - 评估策略风险调整后的表现
   * - 对比不同策略的风险收益特征
   */
  @Column({ type: 'decimal', precision: 10, scale: 4 })
  sharpe_ratio: number;

  /**
   * 交易次数
   *
   * 回测期间执行的交易总次数（买入 + 卖出）
   *
   * 用途：
   * - 评估策略交易频率
   * - 估算实际交易成本
   * - 分析策略活跃度
   */
  @Column({ type: 'int' })
  trades_count: number;

  /**
   * 创建时间
   * 自动记录回测结果的创建时间
   */
  @CreateDateColumn()
  created_at: Date;
}
