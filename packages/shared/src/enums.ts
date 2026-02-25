/**
 * 共享的枚举类型
 */

// 基金类型
export enum FundType {
  STOCK = 'STOCK', // 股票型
  BOND = 'BOND', // 债券型
  HYBRID = 'HYBRID', // 混合型
  MONEY_MARKET = 'MONEY_MARKET', // 货币市场型
  INDEX = 'INDEX', // 指数型
  QDII = 'QDII', // QDII
}

// 交易类型
export enum TransactionType {
  BUY = 'BUY', // 买入
  SELL = 'SELL', // 卖出
}

// 交易状态
export enum TransactionStatus {
  PENDING = 'PENDING', // 待处理
  SUBMITTED = 'SUBMITTED', // 已提交
  CONFIRMED = 'CONFIRMED', // 已确认
  FAILED = 'FAILED', // 失败
  CANCELLED = 'CANCELLED', // 已取消
}

// 策略类型
export enum StrategyType {
  AUTO_INVEST = 'AUTO_INVEST', // 定投
  TAKE_PROFIT_STOP_LOSS = 'TAKE_PROFIT_STOP_LOSS', // 止盈止损
  GRID_TRADING = 'GRID_TRADING', // 网格交易
  REBALANCE = 'REBALANCE', // 再平衡
}

// 策略状态
export enum StrategyStatus {
  ACTIVE = 'ACTIVE', // 激活
  PAUSED = 'PAUSED', // 暂停
  STOPPED = 'STOPPED', // 停止
}

// 定投频率
export enum InvestFrequency {
  DAILY = 'DAILY', // 每日
  WEEKLY = 'WEEKLY', // 每周
  MONTHLY = 'MONTHLY', // 每月
}
