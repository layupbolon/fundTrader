import { apiClient } from './client';

export interface OperationJobResult {
  message: string;
  job_id: string | number;
}

export function triggerNavSync(): Promise<OperationJobResult> {
  return apiClient<OperationJobResult>('/operations/sync-nav', { method: 'POST' });
}

export function triggerPositionRefresh(): Promise<OperationJobResult> {
  return apiClient<OperationJobResult>('/operations/refresh-positions', { method: 'POST' });
}

export function triggerSnapshot(): Promise<OperationJobResult> {
  return apiClient<OperationJobResult>('/operations/create-snapshot', { method: 'POST' });
}
