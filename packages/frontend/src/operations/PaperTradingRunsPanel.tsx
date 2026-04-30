import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { getPaperTradingRuns, type PaperTradingRun } from '../api/operations';

export default function PaperTradingRunsPanel() {
  const [paperRuns, setPaperRuns] = useState<PaperTradingRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  async function loadPaperRuns() {
    setLoading(true);
    setError(null);
    try {
      setPaperRuns(await getPaperTradingRuns(7, 10));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Paper trading 记录加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPaperRuns();
  }, []);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Paper trading 观察</h2>
          <p className="mt-1 text-sm text-gray-500">最近 7 天 broker 模拟交易运行记录。</p>
        </div>
        <button
          onClick={() => void loadPaperRuns()}
          disabled={loading}
          className="min-h-11 cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? '刷新中...' : '刷新记录'}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-700">{error}</div>
      )}
      {!error && loading && <div className="mt-4 text-sm text-gray-500">正在加载记录...</div>}
      {!error && !loading && paperRuns.length === 0 && (
        <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
          暂无 paper trading 运行记录
        </div>
      )}
      {!error && !loading && paperRuns.length > 0 && (
        <PaperRunsTable
          runs={paperRuns}
          expandedRunId={expandedRunId}
          onToggle={(runId) => setExpandedRunId((current) => (current === runId ? null : runId))}
        />
      )}
    </section>
  );
}

function PaperRunsTable({
  runs,
  expandedRunId,
  onToggle,
}: {
  runs: PaperTradingRun[];
  expandedRunId: string | null;
  onToggle: (runId: string) => void;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
      <div className="hidden grid-cols-[minmax(180px,1fr)_120px_120px_120px_160px_88px] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 md:grid">
        <span>Run</span>
        <span>提交</span>
        <span>失败</span>
        <span>人工接管</span>
        <span>最近事件</span>
        <span>明细</span>
      </div>
      {runs.map((run) => (
        <div key={run.runId} className="border-b border-gray-100 last:border-b-0">
          <div className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(180px,1fr)_120px_120px_120px_160px_88px] md:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{run.runId}</p>
              <p className="mt-1 truncate text-xs text-gray-500">
                {run.transactionId || '-'} / {run.orderId || '-'}
              </p>
            </div>
            <Metric label="提交" value={run.submittedCount} tone="success" />
            <Metric label="失败" value={run.failedCount} tone="danger" />
            <Metric label="人工接管" value={run.manualInterventionCount} tone="warning" />
            <div className="text-xs text-gray-500">
              <p>{formatDateTime(run.lastSeenAt)}</p>
              {run.latestReason && <p className="mt-1 truncate">{run.latestReason}</p>}
            </div>
            <button
              type="button"
              onClick={() => onToggle(run.runId)}
              aria-expanded={expandedRunId === run.runId}
              className="min-h-10 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              {expandedRunId === run.runId ? '收起' : '展开'}
            </button>
          </div>
          {expandedRunId === run.runId && <PaperRunEvents run={run} />}
        </div>
      ))}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'danger' | 'warning';
}) {
  const toneClass = {
    success: 'bg-success-50 text-success-700',
    danger: 'bg-danger-50 text-danger-700',
    warning: 'bg-warning-50 text-warning-600',
  }[tone];

  return (
    <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 md:bg-transparent md:px-0">
      <span className="text-xs text-gray-500 md:hidden">{label}</span>
      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function PaperRunEvents({ run }: { run: PaperTradingRun }) {
  return (
    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
      <div className="space-y-3">
        {run.events.map((event) => (
          <div key={event.logId} className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{event.description}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatDateTime(event.createdAt)} · {event.status || '-'} · {event.reason || '-'}
                </p>
              </div>
              {event.manualInterventionRequired && (
                <span className="w-fit rounded-md bg-warning-50 px-2 py-1 text-xs font-semibold text-warning-600">
                  人工接管
                </span>
              )}
            </div>
            {event.brokerEvidence && <BrokerEvidence evidence={event.brokerEvidence} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function BrokerEvidence({
  evidence,
}: {
  evidence: NonNullable<PaperTradingRun['events'][number]['brokerEvidence']>;
}) {
  return (
    <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
      <div className="grid gap-2 sm:grid-cols-2">
        <EvidenceItem label="操作" value={evidence.operation} />
        <EvidenceItem label="采集时间" value={evidence.capturedAt} />
        {evidence.hasScreenshot && <EvidenceItem label="截图证据" value="已采集" />}
      </div>
      {evidence.domSummaryPreview && (
        <p className="mt-3 rounded-md bg-white p-3 text-xs leading-5 text-gray-700">
          <span className="text-gray-400">摘要：</span>
          <span className="break-words">{evidence.domSummaryPreview}</span>
        </p>
      )}
    </div>
  );
}

function EvidenceItem({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null;
  }

  return (
    <p className="min-w-0">
      <span className="text-gray-400">{label}：</span>
      <span className="break-all text-gray-700">{value}</span>
    </p>
  );
}
