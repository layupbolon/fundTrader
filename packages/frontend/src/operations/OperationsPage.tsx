import { useState } from 'react';
import {
  triggerNavSync,
  triggerPositionRefresh,
  triggerSnapshot,
  type OperationJobResult,
} from '../api/operations';
import { ApiError } from '../api/client';

type OperationAction = {
  id: string;
  title: string;
  description: string;
  run: () => Promise<OperationJobResult>;
};

const ACTIONS: OperationAction[] = [
  {
    id: 'sync-nav',
    title: '同步基金净值',
    description: '投递净值同步任务，用于修复缺失或滞后的基金净值。',
    run: triggerNavSync,
  },
  {
    id: 'refresh-positions',
    title: '刷新持仓市值',
    description: '重新计算持仓市值、收益和收益率。',
    run: triggerPositionRefresh,
  },
  {
    id: 'create-snapshot',
    title: '生成资产快照',
    description: '写入当前组合快照，供收益分析和回溯使用。',
    run: triggerSnapshot,
  },
];

export default function OperationsPage() {
  const [runningId, setRunningId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAction(action: OperationAction) {
    setRunningId(action.id);
    setNotice(null);
    setError(null);
    try {
      const result = await action.run();
      setNotice(`${action.title}已投递，任务 ID：${result.job_id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `${action.title}失败`);
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">运维任务面板</h1>
        <p className="mt-1 text-sm text-gray-500">手动触发数据同步、持仓刷新和快照任务。</p>
      </div>

      {notice && (
        <div className="rounded-lg bg-success-50 p-3 text-sm text-success-700">{notice}</div>
      )}
      {error && <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-700">{error}</div>}

      <div className="grid gap-3 md:grid-cols-3">
        {ACTIONS.map((action) => {
          const running = runningId === action.id;
          return (
            <section
              key={action.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <h2 className="text-sm font-semibold text-gray-900">{action.title}</h2>
              <p className="mt-2 min-h-10 text-sm leading-6 text-gray-500">{action.description}</p>
              <button
                onClick={() => runAction(action)}
                disabled={runningId !== null}
                className="mt-4 min-h-11 w-full cursor-pointer rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {running ? '投递中...' : '立即执行'}
              </button>
            </section>
          );
        })}
      </div>
    </div>
  );
}
