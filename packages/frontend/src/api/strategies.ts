import { apiClient } from './client';
import type { PaginatedResponse, Strategy, CreateStrategyPayload, UpdateStrategyPayload } from './types';

export function fetchStrategies(page = 1, limit = 10): Promise<PaginatedResponse<Strategy>> {
  return apiClient<PaginatedResponse<Strategy>>(`/strategies?page=${page}&limit=${limit}`);
}

export function fetchStrategy(id: string): Promise<Strategy> {
  return apiClient<Strategy>(`/strategies/${id}`);
}

export function createStrategy(payload: CreateStrategyPayload): Promise<Strategy> {
  return apiClient<Strategy>('/strategies', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateStrategy(id: string, payload: UpdateStrategyPayload): Promise<Strategy> {
  return apiClient<Strategy>(`/strategies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteStrategy(id: string): Promise<{ message: string }> {
  return apiClient<{ message: string }>(`/strategies/${id}`, {
    method: 'DELETE',
  });
}

export function toggleStrategy(id: string): Promise<Strategy> {
  return apiClient<Strategy>(`/strategies/${id}/toggle`, {
    method: 'POST',
  });
}
