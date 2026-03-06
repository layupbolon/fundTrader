import { apiClient } from './client';
import type {
  PaginatedResponse,
  Transaction,
  CreateTransactionPayload,
  TransactionStatusRefreshResult,
  BatchTransactionOperationResult,
} from './types';

export function fetchTransactions(
  page = 1,
  limit = 10,
  filters?: {
    fundCode?: string;
    type?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  },
): Promise<PaginatedResponse<Transaction>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filters?.fundCode) params.set('fund_code', filters.fundCode);
  if (filters?.type) params.set('type', filters.type);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.startDate) params.set('start_date', filters.startDate);
  if (filters?.endDate) params.set('end_date', filters.endDate);
  return apiClient<PaginatedResponse<Transaction>>(`/transactions?${params}`);
}

export function fetchTransaction(id: string): Promise<Transaction> {
  return apiClient<Transaction>(`/transactions/${id}`);
}

export function createTransaction(payload: CreateTransactionPayload): Promise<{ id: string }> {
  return apiClient<{ id: string }>('/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function refreshTransactionStatus(id: string): Promise<TransactionStatusRefreshResult> {
  return apiClient<TransactionStatusRefreshResult>(`/transactions/${id}/refresh-status`, {
    method: 'POST',
  });
}

export function cancelTransaction(id: string): Promise<{ id: string; status: string }> {
  return apiClient<{ id: string; status: string }>(`/transactions/${id}/cancel`, {
    method: 'POST',
  });
}

export function batchRefreshTransactionStatus(
  transactionIds: string[],
): Promise<BatchTransactionOperationResult> {
  return apiClient<BatchTransactionOperationResult>('/transactions/batch/refresh-status', {
    method: 'POST',
    body: JSON.stringify({ transaction_ids: transactionIds }),
  });
}

export function batchCancelTransactions(
  transactionIds: string[],
): Promise<BatchTransactionOperationResult> {
  return apiClient<BatchTransactionOperationResult>('/transactions/batch/cancel', {
    method: 'POST',
    body: JSON.stringify({ transaction_ids: transactionIds }),
  });
}
