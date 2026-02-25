export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

export enum StrategyType {
  AUTO_INVEST = 'AUTO_INVEST',
  TAKE_PROFIT = 'TAKE_PROFIT',
  STOP_LOSS = 'STOP_LOSS',
}

export enum InvestFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}
