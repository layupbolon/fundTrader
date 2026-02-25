/**
 * 共享的接口类型
 */

import { FundType, TransactionType, TransactionStatus, StrategyType, StrategyStatus, InvestFrequency } from './enums';

// 基金基本信息
export interface IFund {
  id: string;
  code: string;
  name: string;
  type: FundType;
  manager: string;
  company: string;
  createdAt: Date;
  updatedAt: Date;
}

// 基金净值
export interface IFundNav {
  id: string;
  fundId: string;
  date: Date;
  nav: number;
  accumulatedNav: number;
  dailyGrowthRate: number;
  createdAt: Date;
}

// 持仓信息
export interface IPosition {
  id: string;
  userId: string;
  fundId: string;
  shares: number;
  cost: number;
  currentValue: number;
  profitRate: number;
  createdAt: Date;
  updatedAt: Date;
}

// 交易记录
export interface ITransaction {
  id: string;
  userId: string;
  fundId: string;
  type: TransactionType;
  amount: number;
  shares: number;
  nav: number;
  fee: number;
  status: TransactionStatus;
  submittedAt: Date;
  confirmedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 策略配置
export interface IStrategy {
  id: string;
  userId: string;
  fundId: string;
  type: StrategyType;
  status: StrategyStatus;
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// 定投策略配置
export interface IAutoInvestConfig {
  frequency: InvestFrequency;
  amount: number;
  startDate: Date;
  endDate?: Date;
}

// 止盈止损策略配置
export interface ITakeProfitStopLossConfig {
  targetProfitRate: number;
  stopLossRate: number;
  trailingStopRate?: number;
}

// 回测结果
export interface IBacktestResult {
  id: string;
  strategyId: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  createdAt: Date;
}
