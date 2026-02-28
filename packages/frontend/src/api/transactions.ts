import { apiClient } from './client';
import type { PaginatedResponse, Transaction } from './types';

export function fetchTransactions(
  page = 1,
  limit = 10,
  fundCode?: string,
): Promise<PaginatedResponse<Transaction>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (fundCode) params.set('fund_code', fundCode);
  return apiClient<PaginatedResponse<Transaction>>(`/transactions?${params}`);
}

export function fetchTransaction(id: string): Promise<Transaction> {
  return apiClient<Transaction>(`/transactions/${id}`);
}
