import { apiClient } from './client';

/**
 * 收益数据
 */
export interface ReturnsDataItem {
  date: string;
  total_assets: number;
  total_profit: number;
  total_profit_rate: number;
  position_count: number;
}

/**
 * 持仓分析数据
 */
export interface PositionAnalysisItem {
  fund_code: string;
  fund_name: string;
  current_value: number;
  position_ratio: number;
  profit: number;
  profit_rate: number;
}

/**
 * 交易统计数据
 */
export interface TransactionStatsItem {
  type: 'BUY' | 'SELL';
  count: number;
  total_amount: number;
  success_count: number;
  failed_count: number;
}

/**
 * 获取收益分析数据
 * @param startDate 开始日期 (YYYY-MM-DD)
 * @param endDate 结束日期 (YYYY-MM-DD)
 */
export function fetchReturnsData(
  startDate: string,
  endDate: string,
): Promise<{ data: ReturnsDataItem[] }> {
  return apiClient<{ data: ReturnsDataItem[] }>(
    `/analytics/returns?startDate=${startDate}&endDate=${endDate}`,
  );
}

/**
 * 获取持仓分析数据
 */
export function fetchPositionAnalysis(): Promise<{ data: PositionAnalysisItem[] }> {
  return apiClient<{ data: PositionAnalysisItem[] }>('/analytics/positions');
}

/**
 * 获取交易统计数据
 * @param startDate 开始日期 (YYYY-MM-DD)
 * @param endDate 结束日期 (YYYY-MM-DD)
 */
export function fetchTransactionStats(
  startDate: string,
  endDate: string,
): Promise<{ data: TransactionStatsItem[] }> {
  return apiClient<{ data: TransactionStatsItem[] }>(
    `/analytics/transactions?startDate=${startDate}&endDate=${endDate}`,
  );
}
