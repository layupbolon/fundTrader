import { apiClient } from './client';
import type { PaginatedResponse, Fund } from './types';

export function fetchFunds(page = 1, limit = 50): Promise<PaginatedResponse<Fund>> {
  return apiClient<PaginatedResponse<Fund>>(`/funds?page=${page}&limit=${limit}`);
}

export function fetchFund(code: string): Promise<Fund> {
  return apiClient<Fund>(`/funds/${code}`);
}
