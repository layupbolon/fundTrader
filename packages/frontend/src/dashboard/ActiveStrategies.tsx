import { useState } from 'react';
import type { Strategy } from '../api/types';
import { StrategyType } from '../api/types';
import { toggleStrategy } from '../api/strategies';
import EmptyState from '../shared/EmptyState';

const TYPE_LABELS: Record<StrategyType, string> = {
  [StrategyType.AUTO_INVEST]: '定投',
  [StrategyType.TAKE_PROFIT_STOP_LOSS]: '止盈止损',
  [StrategyType.GRID_TRADING]: '网格交易',
  [StrategyType.REBALANCE]: '再平衡',
};

interface ActiveStrategiesProps {
  strategies: Strategy[];
  onUpdate: () => void;
}

export default function ActiveStrategies({ strategies, onUpdate }: ActiveStrategiesProps) {
  const [toggling, setToggling] = useState<string | null>(null);

  const activeStrategies = strategies.filter((s) => s.enabled);

  async function handleToggle(id: string) {
    setToggling(id);
    try {
      await toggleStrategy(id);
      onUpdate();
    } finally {
      setToggling(null);
    }
  }

  if (activeStrategies.length === 0) {
    return <EmptyState message="暂无活跃策略" />;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">活跃策略</h2>
      </div>
      <div className="divide-y divide-gray-50">
        {activeStrategies.map((s) => (
          <div key={s.id} className="px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{s.name}</p>
              <p className="text-xs text-gray-400">
                {TYPE_LABELS[s.type]} · {s.fund?.name || s.fund_code}
              </p>
            </div>
            <button
              onClick={() => handleToggle(s.id)}
              disabled={toggling === s.id}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-primary-600 transition-colors disabled:opacity-50"
              role="switch"
              aria-checked="true"
            >
              <span className="translate-x-5 pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
