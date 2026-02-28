import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Strategy } from '../api/types';
import { StrategyType } from '../api/types';
import { toggleStrategy, deleteStrategy } from '../api/strategies';

const TYPE_LABELS: Record<StrategyType, string> = {
  [StrategyType.AUTO_INVEST]: '定投',
  [StrategyType.TAKE_PROFIT_STOP_LOSS]: '止盈止损',
  [StrategyType.GRID_TRADING]: '网格交易',
  [StrategyType.REBALANCE]: '再平衡',
};

const TYPE_COLORS: Record<StrategyType, string> = {
  [StrategyType.AUTO_INVEST]: 'bg-blue-100 text-blue-700',
  [StrategyType.TAKE_PROFIT_STOP_LOSS]: 'bg-orange-100 text-orange-700',
  [StrategyType.GRID_TRADING]: 'bg-purple-100 text-purple-700',
  [StrategyType.REBALANCE]: 'bg-teal-100 text-teal-700',
};

function formatConfig(type: StrategyType, config: Record<string, unknown>): string {
  switch (type) {
    case StrategyType.AUTO_INVEST:
      return `每次 ¥${config.amount || '-'} · ${config.frequency || '-'}`;
    case StrategyType.TAKE_PROFIT_STOP_LOSS:
      return `止盈 ${((config.take_profit_rate as number) * 100).toFixed(0)}% · 止损 ${((config.stop_loss_rate as number) * 100).toFixed(0)}%`;
    case StrategyType.GRID_TRADING:
      return `${config.grid_count || '-'} 格 · 每格 ¥${config.amount_per_grid || '-'}`;
    case StrategyType.REBALANCE:
      return `阈值 ${((config.rebalance_threshold as number) * 100).toFixed(0)}%`;
    default:
      return '';
  }
}

interface StrategyCardProps {
  strategy: Strategy;
  onUpdate: () => void;
}

export default function StrategyCard({ strategy, onUpdate }: StrategyCardProps) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleToggle() {
    setToggling(true);
    try {
      await toggleStrategy(strategy.id);
      onUpdate();
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteStrategy(strategy.id);
      onUpdate();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{strategy.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {strategy.fund?.name || strategy.fund_code}
          </p>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[strategy.type]}`}>
          {TYPE_LABELS[strategy.type]}
        </span>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        {formatConfig(strategy.type, strategy.config)}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-50 ${
              strategy.enabled ? 'bg-primary-600' : 'bg-gray-200'
            }`}
            role="switch"
            aria-checked={strategy.enabled}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                strategy.enabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-xs text-gray-500">
            {strategy.enabled ? '已启用' : '已暂停'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/strategies/${strategy.id}/edit`}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            编辑
          </Link>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs text-danger-600 hover:text-danger-700 font-medium disabled:opacity-50"
              >
                确认
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-gray-500 hover:text-gray-700 font-medium"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-danger-600 hover:text-danger-700 font-medium"
            >
              删除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
