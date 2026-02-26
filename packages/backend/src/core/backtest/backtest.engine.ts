import { Injectable } from '@nestjs/common';
import { FundDataService } from '../../services/data/fund-data.service';
import { FundNav, StrategyType, InvestFrequency } from '../../models';

/**
 * 回测参数接口
 *
 * 定义运行策略回测所需的所有参数。
 */
export interface BacktestParams {
  /**
   * 策略配置
   * 包含策略类型和具体参数，格式与 Strategy.config 相同
   */
  strategy_config: any;

  /**
   * 基金代码
   * 回测应用的基金
   */
  fund_code: string;

  /**
   * 回测开始日期
   * 历史数据的起始日期
   */
  start_date: Date;

  /**
   * 回测结束日期
   * 历史数据的结束日期
   */
  end_date: Date;

  /**
   * 初始资金
   * 回测开始时的初始投入金额（人民币）
   */
  initial_capital: number;
}

/**
 * 回测结果接口
 *
 * 包含回测的所有性能指标和交易记录。
 */
export interface BacktestResult {
  /** 初始资金 */
  initial_capital: number;

  /** 最终市值 */
  final_value: number;

  /** 总收益率 */
  total_return: number;

  /** 年化收益率 */
  annual_return: number;

  /** 最大回撤 */
  max_drawdown: number;

  /** 夏普比率 */
  sharpe_ratio: number;

  /** 交易次数 */
  trades_count: number;

  /** 交易记录列表 */
  trades: Trade[];
}

/**
 * 交易记录接口
 *
 * 回测过程中的单笔交易记录。
 */
export interface Trade {
  /** 交易日期 */
  date: Date;

  /** 交易类型 */
  type: 'BUY' | 'SELL';

  /** 买入金额（仅买入时有值） */
  amount?: number;

  /** 卖出份额（仅卖出时有值） */
  shares?: number;

  /** 成交价格（净值） */
  price: number;
}

/**
 * 策略信号接口
 *
 * 策略评估后产生的交易信号。
 */
interface Signal {
  /** 操作类型 */
  action: 'BUY' | 'SELL' | 'HOLD';

  /** 买入金额（仅买入时有值） */
  amount?: number;

  /** 卖出比例（仅卖出时有值） */
  ratio?: number;
}

/**
 * 回测引擎
 *
 * 通过历史净值数据模拟策略执行，评估策略在过去的表现。
 * 回测是验证策略有效性的重要工具，可以帮助优化策略参数。
 *
 * 核心功能：
 * 1. 加载历史净值数据
 * 2. 按时间顺序模拟策略执行
 * 3. 记录每笔交易和持仓变化
 * 4. 计算性能指标（收益率、夏普比率、最大回撤）
 *
 * 回测流程：
 * 1. 初始化：设置初始资金和持仓
 * 2. 遍历历史数据：逐日评估策略信号
 * 3. 执行交易：根据信号模拟买入/卖出
 * 4. 计算指标：统计回测结果
 *
 * 注意事项：
 * - 回测使用历史数据，不考虑交易成本和滑点
 * - 回测结果不代表未来表现
 * - 需要避免过度拟合历史数据
 * - 应该在样本外数据上验证策略
 *
 * 使用场景：
 * - 验证策略逻辑是否正确
 * - 优化策略参数（如定投金额、止盈比例）
 * - 对比不同策略的表现
 * - 评估策略的风险收益特征
 */
@Injectable()
export class BacktestEngine {
  constructor(private fundDataService: FundDataService) {}

  /**
   * 运行策略回测
   *
   * 完整的回测流程：
   * 1. 加载历史净值数据
   * 2. 初始化回测状态（现金、持仓）
   * 3. 逐日评估策略信号并执行交易
   * 4. 记录持仓价值变化
   * 5. 计算性能指标
   *
   * @param params 回测参数
   * @returns 回测结果，包含性能指标和交易记录
   * @throws Error 如果没有历史数据
   *
   * @example
   * const result = await backtestEngine.runBacktest({
   *   strategy_config: {
   *     type: StrategyType.AUTO_INVEST,
   *     amount: 500,
   *     frequency: InvestFrequency.WEEKLY
   *   },
   *   fund_code: '000001',
   *   start_date: new Date('2023-01-01'),
   *   end_date: new Date('2024-01-01'),
   *   initial_capital: 10000
   * });
   */
  async runBacktest(params: BacktestParams): Promise<BacktestResult> {
    const { strategy_config, fund_code, start_date, end_date, initial_capital } = params;

    // 获取历史净值数据
    // 从数据库或外部 API 加载指定时间范围的净值数据
    const historicalNav = await this.fundDataService.getHistoricalNav(
      fund_code,
      start_date,
      end_date,
    );

    if (historicalNav.length === 0) {
      throw new Error('No historical data available for backtest');
    }

    // 初始化回测状态
    let cash = initial_capital; // 可用现金
    let shares = 0; // 持有份额
    const trades: Trade[] = []; // 交易记录
    const portfolioValues: number[] = []; // 每日持仓价值

    // 遍历每个交易日
    // 按时间顺序模拟策略执行
    for (const nav of historicalNav) {
      const currentNav = Number(nav.nav);

      // 计算当前持仓价值
      // 持仓价值 = 现金 + 份额 * 当前净值
      const portfolioValue = cash + shares * currentNav;
      portfolioValues.push(portfolioValue);

      // 评估策略信号
      // 根据策略类型和配置判断是否应该买入/卖出
      const signal = this.evaluateStrategy(strategy_config, nav, { cash, shares }, historicalNav);

      // 执行买入
      // 检查信号类型、买入金额和现金是否充足
      if (signal.action === 'BUY' && signal.amount && cash >= signal.amount) {
        const buyShares = signal.amount / currentNav; // 计算买入份额
        shares += buyShares; // 增加持仓
        cash -= signal.amount; // 减少现金
        trades.push({
          date: new Date(nav.date),
          type: 'BUY',
          amount: signal.amount,
          price: currentNav,
        });
      }

      // 执行卖出
      // 检查信号类型、卖出比例和持仓是否充足
      if (signal.action === 'SELL' && signal.ratio && shares > 0) {
        const sellShares = shares * signal.ratio; // 计算卖出份额
        const sellAmount = sellShares * currentNav; // 计算卖出金额
        shares -= sellShares; // 减少持仓
        cash += sellAmount; // 增加现金
        trades.push({
          date: new Date(nav.date),
          type: 'SELL',
          shares: sellShares,
          price: currentNav,
        });
      }
    }

    // 计算最终价值
    // 使用最后一天的净值计算剩余持仓价值
    const finalNav = Number(historicalNav[historicalNav.length - 1].nav);
    const finalValue = cash + shares * finalNav;

    // 计算回测指标
    const totalReturn = (finalValue - initial_capital) / initial_capital;
    const annualReturn = this.calculateAnnualReturn(totalReturn, start_date, end_date);
    const maxDrawdown = this.calculateMaxDrawdown(portfolioValues);
    const sharpeRatio = this.calculateSharpeRatio(portfolioValues);

    return {
      initial_capital,
      final_value: finalValue,
      total_return: totalReturn,
      annual_return: annualReturn,
      max_drawdown: maxDrawdown,
      sharpe_ratio: sharpeRatio,
      trades_count: trades.length,
      trades,
    };
  }

  /**
   * 评估策略信号
   *
   * 根据策略类型调用对应的评估方法，判断当前时刻应该执行什么操作。
   *
   * @param config 策略配置
   * @param currentNav 当前净值数据
   * @param state 当前持仓状态（现金、份额）
   * @param historicalNav 历史净值数据（用于计算收益率等）
   * @returns 策略信号（买入/卖出/持有）
   * @private
   */
  private evaluateStrategy(
    config: any,
    currentNav: FundNav,
    state: { cash: number; shares: number },
    historicalNav: FundNav[],
  ): Signal {
    const strategyType = config.type as StrategyType;

    switch (strategyType) {
      case StrategyType.AUTO_INVEST:
        return this.evaluateAutoInvest(config, currentNav, state);

      case StrategyType.TAKE_PROFIT:
        return this.evaluateTakeProfit(config, currentNav, state, historicalNav);

      case StrategyType.STOP_LOSS:
        return this.evaluateStopLoss(config, currentNav, state, historicalNav);

      default:
        return { action: 'HOLD' };
    }
  }

  /**
   * 评估定投策略信号
   *
   * 根据定投频率和配置判断是否应该买入。
   *
   * @param config 定投策略配置
   * @param currentNav 当前净值数据
   * @param state 当前持仓状态
   * @returns 策略信号
   * @private
   */
  private evaluateAutoInvest(
    config: any,
    currentNav: FundNav,
    state: { cash: number; shares: number },
  ): Signal {
    const { amount, frequency, day_of_week, day_of_month } = config;
    const date = new Date(currentNav.date);

    let shouldInvest = false;

    // 根据定投频率判断是否应该执行
    switch (frequency) {
      case InvestFrequency.DAILY:
        // 日定投：每天都执行
        shouldInvest = true;
        break;

      case InvestFrequency.WEEKLY:
        // 周定投：每周固定某天执行
        shouldInvest = date.getDay() === (day_of_week || 1);
        break;

      case InvestFrequency.MONTHLY:
        // 月定投：每月固定某天执行
        shouldInvest = date.getDate() === (day_of_month || 1);
        break;
    }

    // 检查是否应该定投且现金充足
    if (shouldInvest && state.cash >= amount) {
      return { action: 'BUY', amount };
    }

    return { action: 'HOLD' };
  }

  /**
   * 评估止盈策略信号
   *
   * 计算当前收益率，判断是否达到止盈条件。
   *
   * @param config 止盈策略配置
   * @param currentNav 当前净值数据
   * @param state 当前持仓状态
   * @param historicalNav 历史净值数据
   * @returns 策略信号
   * @private
   */
  private evaluateTakeProfit(
    config: any,
    currentNav: FundNav,
    state: { cash: number; shares: number },
    historicalNav: FundNav[],
  ): Signal {
    // 没有持仓时不执行止盈
    if (state.shares === 0) {
      return { action: 'HOLD' };
    }

    const { target_rate, sell_ratio } = config;
    const avgCost = this.calculateAvgCost(state, historicalNav);
    const currentPrice = Number(currentNav.nav);
    const profitRate = (currentPrice - avgCost) / avgCost;

    // 收益率达到目标时触发止盈
    if (profitRate >= target_rate) {
      return { action: 'SELL', ratio: sell_ratio };
    }

    return { action: 'HOLD' };
  }

  /**
   * 评估止损策略信号
   *
   * 计算当前收益率，判断是否达到止损条件。
   *
   * @param config 止损策略配置
   * @param currentNav 当前净值数据
   * @param state 当前持仓状态
   * @param historicalNav 历史净值数据
   * @returns 策略信号
   * @private
   */
  private evaluateStopLoss(
    config: any,
    currentNav: FundNav,
    state: { cash: number; shares: number },
    historicalNav: FundNav[],
  ): Signal {
    // 没有持仓时不执行止损
    if (state.shares === 0) {
      return { action: 'HOLD' };
    }

    const { max_drawdown, sell_ratio } = config;
    const avgCost = this.calculateAvgCost(state, historicalNav);
    const currentPrice = Number(currentNav.nav);
    const profitRate = (currentPrice - avgCost) / avgCost;

    // 亏损达到最大回撤时触发止损
    if (profitRate <= max_drawdown) {
      return { action: 'SELL', ratio: sell_ratio };
    }

    return { action: 'HOLD' };
  }

  /**
   * 计算平均成本
   *
   * 简化实现：使用历史平均净值作为成本。
   * 完整实现需要跟踪每笔买入的成本和份额。
   *
   * @param state 当前持仓状态
   * @param historicalNav 历史净值数据
   * @returns 平均成本
   * @private
   */
  private calculateAvgCost(
    state: { cash: number; shares: number },
    historicalNav: FundNav[],
  ): number {
    // 简化实现：使用历史平均净值作为成本
    // TODO: 实现完整的成本跟踪逻辑
    const avgNav =
      historicalNav.reduce((sum, nav) => sum + Number(nav.nav), 0) / historicalNav.length;
    return avgNav;
  }

  /**
   * 计算年化收益率
   *
   * 将回测期间的总收益率转换为年化收益率，便于对比不同时间长度的回测结果。
   *
   * 计算公式：(1 + 总收益率) ^ (1 / 年数) - 1
   *
   * @param totalReturn 总收益率
   * @param startDate 回测开始日期
   * @param endDate 回测结束日期
   * @returns 年化收益率
   * @private
   *
   * @example
   * // 1年内收益20%，年化收益率 = 20%
   * // 2年内收益44%，年化收益率 = (1.44)^(1/2) - 1 = 20%
   */
  private calculateAnnualReturn(totalReturn: number, startDate: Date, endDate: Date): number {
    const days = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const years = days / 365;
    return Math.pow(1 + totalReturn, 1 / years) - 1;
  }

  /**
   * 计算最大回撤
   *
   * 最大回撤是从最高点到最低点的最大跌幅，用于衡量策略的风险。
   * 回撤越小，策略越稳定。
   *
   * 计算方法：
   * 1. 遍历持仓价值序列
   * 2. 记录历史最高点
   * 3. 计算当前点相对于最高点的回撤
   * 4. 取所有回撤中的最大值
   *
   * @param portfolioValues 每日持仓价值序列
   * @returns 最大回撤（正数，如 0.23 表示最大回撤 23%）
   * @private
   *
   * @example
   * // 持仓价值：10000 -> 12000 -> 9000
   * // 最高点：12000
   * // 最大回撤：(12000 - 9000) / 12000 = 0.25 (25%)
   */
  private calculateMaxDrawdown(portfolioValues: number[]): number {
    let maxDrawdown = 0;
    let peak = portfolioValues[0];

    for (const value of portfolioValues) {
      // 更新历史最高点
      if (value > peak) {
        peak = value;
      }

      // 计算当前回撤
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  /**
   * 计算夏普比率
   *
   * 夏普比率是风险调整后的收益率指标，衡量每承担一单位风险获得的超额收益。
   * 夏普比率越高，策略的风险收益比越好。
   *
   * 计算步骤：
   * 1. 计算每日收益率序列
   * 2. 计算平均日收益率
   * 3. 计算收益率标准差（波动率）
   * 4. 夏普比率 = (平均收益率 - 无风险利率) / 标准差
   * 5. 年化：乘以 sqrt(252)（假设一年252个交易日）
   *
   * 解读：
   * - > 1: 较好的风险收益比
   * - > 2: 优秀的风险收益比
   * - < 0: 收益低于无风险利率
   *
   * @param portfolioValues 每日持仓价值序列
   * @returns 年化夏普比率
   * @private
   *
   * @example
   * // 假设日均收益率 0.1%，标准差 1%
   * // 夏普比率 = (0.001 / 0.01) * sqrt(252) ≈ 1.59
   */
  private calculateSharpeRatio(portfolioValues: number[]): number {
    if (portfolioValues.length < 2) {
      return 0;
    }

    // 计算日收益率
    const returns: number[] = [];
    for (let i = 1; i < portfolioValues.length; i++) {
      const dailyReturn = (portfolioValues[i] - portfolioValues[i - 1]) / portfolioValues[i - 1];
      returns.push(dailyReturn);
    }

    // 计算平均收益率和标准差
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // 假设无风险利率为0
    // 实际应用中可以使用国债收益率作为无风险利率
    const riskFreeRate = 0;

    // 年化夏普比率
    // 乘以 sqrt(252) 将日夏普比率转换为年化夏普比率
    return stdDev === 0 ? 0 : ((avgReturn - riskFreeRate) / stdDev) * Math.sqrt(252);
  }
}
