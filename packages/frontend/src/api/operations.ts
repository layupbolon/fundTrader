import { apiClient } from './client';

export interface OperationJobResult {
  message: string;
  job_id: string | number;
}

export interface PaperTradingRunEvent {
  logId: string;
  transactionId?: string;
  orderId?: string;
  description: string;
  reason?: string;
  status?: string;
  manualInterventionRequired: boolean;
  brokerEvidence?: {
    capturedAt?: string;
    operation?: string;
    hasScreenshot?: boolean;
    domSummaryPreview?: string;
  };
  createdAt: string;
}

export interface PaperTradingRun {
  runId: string;
  transactionId?: string;
  orderId?: string;
  brokerOrderCreatedAt?: string;
  submittedCount: number;
  failedCount: number;
  manualInterventionCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  latestReason?: string;
  events: PaperTradingRunEvent[];
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

export function getPaperTradingRuns(days = 7, limit = 10): Promise<PaperTradingRun[]> {
  const params = new URLSearchParams({
    days: String(days),
    limit: String(limit),
  });
  return apiClient<PaperTradingRun[]>(`/logs/paper-trading/runs?${params.toString()}`);
}
