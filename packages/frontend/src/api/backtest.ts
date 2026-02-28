import { apiClient } from './client';
import type { PaginatedResponse, BacktestResultData, BacktestPayload } from './types';

export function fetchBacktestResults(
  page = 1,
  limit = 10,
): Promise<PaginatedResponse<BacktestResultData>> {
  return apiClient<PaginatedResponse<BacktestResultData>>(`/backtest?page=${page}&limit=${limit}`);
}

export function fetchBacktestResult(id: string): Promise<BacktestResultData> {
  return apiClient<BacktestResultData>(`/backtest/${id}`);
}

export function runBacktest(payload: BacktestPayload): Promise<BacktestResultData> {
  return apiClient<BacktestResultData>('/backtest', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
