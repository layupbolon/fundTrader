import { Injectable } from '@nestjs/common';
import { FundDataService } from '../../services/data/fund-data.service';
import { FundNav, StrategyType, InvestFrequency } from '../../models';

export interface BacktestParams {
  strategy_config: any;
  fund_code: string;
  start_date: Date;
  end_date: Date;
  initial_capital: number;
}

export interface BacktestResult {
  initial_capital: number;
  final_value: number;
  total_return: number;
  annual_return: number;
  max_drawdown: number;
  sharpe_ratio: number;
  trades_count: number;
  trades: Trade[];
}

export interface Trade {
  date: Date;
  type: 'BUY' | 'SELL';
  amount?: number;
  shares?: number;
  price: number;
}

interface Signal {
  action: 'BUY' | 'SELL' | 'HOLD';
  amount?: number;
  ratio?: number;
}

@Injectable()
export class BacktestEngine {
  constructor(private fundDataService: FundDataService) {}

  async runBacktest(params: BacktestParams): Promise<BacktestResult> {
    const { strategy_config, fund_code, start_date, end_date, initial_capital } = params;

    // 获取历史净值数据
    const historicalNav = await this.fundDataService.getHistoricalNav(
      fund_code,
      start_date,
      end_date,
    );

    if (historicalNav.length === 0) {
      throw new Error('No historical data available for backtest');
    }

    // 初始化回测状态
    let cash = initial_capital;
    let shares = 0;
    const trades: Trade[] = [];
    const portfolioValues: number[] = [];

    // 遍历每个交易日
    for (const nav of historicalNav) {
      const currentNav = Number(nav.nav);

      // 计算当前持仓价值
      const portfolioValue = cash + shares * currentNav;
      portfolioValues.push(portfolioValue);

      // 评估策略信号
      const signal = this.evaluateStrategy(strategy_config, nav, { cash, shares }, historicalNav);

      // 执行买入
      if (signal.action === 'BUY' && signal.amount && cash >= signal.amount) {
        const buyShares = signal.amount / currentNav;
        shares += buyShares;
        cash -= signal.amount;
        trades.push({
          date: new Date(nav.date),
          type: 'BUY',
          amount: signal.amount,
          price: currentNav,
        });
      }

      // 执行卖出
      if (signal.action === 'SELL' && signal.ratio && shares > 0) {
        const sellShares = shares * signal.ratio;
        const sellAmount = sellShares * currentNav;
        shares -= sellShares;
        cash += sellAmount;
        trades.push({
          date: new Date(nav.date),
          type: 'SELL',
          shares: sellShares,
          price: currentNav,
        });
      }
    }

    // 计算最终价值
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

  private evaluateAutoInvest(
    config: any,
    currentNav: FundNav,
    state: { cash: number; shares: number },
  ): Signal {
    const { amount, frequency, day_of_week, day_of_month } = config;
    const date = new Date(currentNav.date);

    let shouldInvest = false;

    switch (frequency) {
      case InvestFrequency.DAILY:
        shouldInvest = true;
        break;

      case InvestFrequency.WEEKLY:
        shouldInvest = date.getDay() === (day_of_week || 1);
        break;

      case InvestFrequency.MONTHLY:
        shouldInvest = date.getDate() === (day_of_month || 1);
        break;
    }

    if (shouldInvest && state.cash >= amount) {
      return { action: 'BUY', amount };
    }

    return { action: 'HOLD' };
  }

  private evaluateTakeProfit(
    config: any,
    currentNav: FundNav,
    state: { cash: number; shares: number },
    historicalNav: FundNav[],
  ): Signal {
    if (state.shares === 0) {
      return { action: 'HOLD' };
    }

    const { target_rate, sell_ratio } = config;
    const avgCost = this.calculateAvgCost(state, historicalNav);
    const currentPrice = Number(currentNav.nav);
    const profitRate = (currentPrice - avgCost) / avgCost;

    if (profitRate >= target_rate) {
      return { action: 'SELL', ratio: sell_ratio };
    }

    return { action: 'HOLD' };
  }

  private evaluateStopLoss(
    config: any,
    currentNav: FundNav,
    state: { cash: number; shares: number },
    historicalNav: FundNav[],
  ): Signal {
    if (state.shares === 0) {
      return { action: 'HOLD' };
    }

    const { max_drawdown, sell_ratio } = config;
    const avgCost = this.calculateAvgCost(state, historicalNav);
    const currentPrice = Number(currentNav.nav);
    const profitRate = (currentPrice - avgCost) / avgCost;

    if (profitRate <= max_drawdown) {
      return { action: 'SELL', ratio: sell_ratio };
    }

    return { action: 'HOLD' };
  }

  private calculateAvgCost(
    state: { cash: number; shares: number },
    historicalNav: FundNav[],
  ): number {
    // 简化实现：使用历史平均净值作为成本
    const avgNav =
      historicalNav.reduce((sum, nav) => sum + Number(nav.nav), 0) / historicalNav.length;
    return avgNav;
  }

  private calculateAnnualReturn(totalReturn: number, startDate: Date, endDate: Date): number {
    const days = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const years = days / 365;
    return Math.pow(1 + totalReturn, 1 / years) - 1;
  }

  private calculateMaxDrawdown(portfolioValues: number[]): number {
    let maxDrawdown = 0;
    let peak = portfolioValues[0];

    for (const value of portfolioValues) {
      if (value > peak) {
        peak = value;
      }

      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

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
    const riskFreeRate = 0;

    // 年化夏普比率
    return stdDev === 0 ? 0 : ((avgReturn - riskFreeRate) / stdDev) * Math.sqrt(252);
  }
}
