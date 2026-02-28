import { InvestFrequency } from '../api/types';

const FREQUENCY_LABELS: Record<InvestFrequency, string> = {
  [InvestFrequency.DAILY]: '每日',
  [InvestFrequency.WEEKLY]: '每周',
  [InvestFrequency.MONTHLY]: '每月',
};

interface Allocation {
  fund_code: string;
  weight: number;
}

interface RebalanceFormProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

export default function RebalanceForm({ config, onChange }: RebalanceFormProps) {
  const allocations = (config.target_allocations as Allocation[]) || [];

  function update(field: string, value: unknown) {
    onChange({ ...config, [field]: value });
  }

  function updateAllocation(index: number, field: keyof Allocation, value: string | number) {
    const updated = allocations.map((a, i) =>
      i === index ? { ...a, [field]: value } : a,
    );
    update('target_allocations', updated);
  }

  function addAllocation() {
    update('target_allocations', [...allocations, { fund_code: '', weight: 0 }]);
  }

  function removeAllocation(index: number) {
    update('target_allocations', allocations.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">目标配置</label>
          <button
            type="button"
            onClick={addAllocation}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            + 添加基金
          </button>
        </div>
        {allocations.length === 0 && (
          <p className="text-xs text-gray-400 py-2">点击"添加基金"开始配置</p>
        )}
        <div className="space-y-2">
          {allocations.map((alloc, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={alloc.fund_code}
                onChange={(e) => updateAllocation(i, 'fund_code', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="基金代码"
                maxLength={6}
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={(alloc.weight * 100).toFixed(0)}
                  onChange={(e) => updateAllocation(i, 'weight', Number(e.target.value) / 100)}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  placeholder="权重"
                />
                <span className="text-sm text-gray-400">%</span>
              </div>
              <button
                type="button"
                onClick={() => removeAllocation(i)}
                className="text-gray-400 hover:text-danger-600 p-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">再平衡阈值 (%)</label>
        <input
          type="number"
          step="1"
          min="1"
          max="50"
          value={config.rebalance_threshold == null ? '' : ((config.rebalance_threshold as number) * 100).toFixed(0)}
          onChange={(e) => update('rebalance_threshold', Number(e.target.value) / 100)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          placeholder="例如 5"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">检查频率</label>
        <select
          value={(config.frequency as InvestFrequency) || InvestFrequency.WEEKLY}
          onChange={(e) => update('frequency', e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        >
          {Object.entries(FREQUENCY_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
