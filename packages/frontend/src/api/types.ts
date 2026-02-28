import {
  StrategyType,
  TransactionType,
  TransactionStatus,
  FundType,
  InvestFrequency,
} from '@fundtrader/shared';

export {
  StrategyType,
  TransactionType,
  TransactionStatus,
  FundType,
  InvestFrequency,
};

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    username: string;
  };
}

export interface UserProfile {
  id: string;
  username: string;
  created_at: string;
  has_broker_credentials: boolean;
}

export interface Fund {
  id: string;
  code: string;
  name: string;
  type: FundType;
  fund_manager: string;
  latest_nav: number;
  nav_date: string;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  user_id: string;
  fund_code: string;
  shares: number;
  cost_basis: number;
  current_nav: number;
  market_value: number;
  profit_loss: number;
  profit_rate: number;
  created_at: string;
  updated_at: string;
  fund?: Fund;
}

export interface Transaction {
  id: string;
  user_id: string;
  fund_code: string;
  type: TransactionType;
  amount: number;
  nav: number;
  shares: number;
  fee: number;
  status: TransactionStatus;
  submitted_at: string;
  confirmed_at: string | null;
  created_at: string;
  fund?: Fund;
  strategy?: Strategy;
}

export interface Strategy {
  id: string;
  user_id: string;
  name: string;
  type: StrategyType;
  fund_code: string;
  config: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  fund?: Fund;
}

export interface AutoInvestConfig {
  amount: number;
  frequency: InvestFrequency;
  day_of_week?: number;
  day_of_month?: number;
}

export interface TakeProfitStopLossConfig {
  take_profit_rate: number;
  stop_loss_rate: number;
  sell_ratio: number;
  trailing_stop?: boolean;
  trailing_stop_rate?: number;
}

export interface GridTradingConfig {
  price_high: number;
  price_low: number;
  grid_count: number;
  amount_per_grid: number;
}

export interface RebalanceConfig {
  target_allocations: Array<{ fund_code: string; weight: number }>;
  rebalance_threshold: number;
  frequency: InvestFrequency;
}

export interface BacktestResultData {
  id: string;
  fund_code: string;
  strategy_config: Record<string, unknown>;
  start_date: string;
  end_date: string;
  initial_capital: number;
  final_value: number;
  total_return: number;
  annual_return: number;
  max_drawdown: number;
  sharpe_ratio: number;
  trades_count: number;
  created_at: string;
}

export interface CreateStrategyPayload {
  name: string;
  type: StrategyType;
  fund_code: string;
  config: Record<string, unknown>;
  enabled?: boolean;
}

export interface UpdateStrategyPayload {
  name?: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

export interface BacktestPayload {
  fund_code: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  strategy_config: Record<string, unknown>;
}
