import { apiClient } from './client';
import type { PaginatedResponse, Position } from './types';

export function fetchPositions(page = 1, limit = 50): Promise<PaginatedResponse<Position>> {
  return apiClient<PaginatedResponse<Position>>(`/positions?page=${page}&limit=${limit}`);
}

export function fetchPosition(id: string): Promise<Position> {
  return apiClient<Position>(`/positions/${id}`);
}
