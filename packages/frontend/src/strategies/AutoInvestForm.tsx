import { InvestFrequency } from '../api/types';

const FREQUENCY_LABELS: Record<InvestFrequency, string> = {
  [InvestFrequency.DAILY]: '每日',
  [InvestFrequency.WEEKLY]: '每周',
  [InvestFrequency.MONTHLY]: '每月',
};

interface AutoInvestFormProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

export default function AutoInvestForm({ config, onChange }: AutoInvestFormProps) {
  const frequency = (config.frequency as InvestFrequency) || InvestFrequency.WEEKLY;

  function update(field: string, value: unknown) {
    onChange({ ...config, [field]: value });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">定投金额 (元)</label>
        <input
          type="number"
          min="1"
          value={(config.amount as number) || ''}
          onChange={(e) => update('amount', Number(e.target.value))}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          placeholder="例如 1000"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">定投频率</label>
        <select
          value={frequency}
          onChange={(e) => update('frequency', e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        >
          {Object.entries(FREQUENCY_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {frequency === InvestFrequency.WEEKLY && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">周几</label>
          <select
            value={(config.day_of_week as number) ?? 1}
            onChange={(e) => update('day_of_week', Number(e.target.value))}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            {['周一', '周二', '周三', '周四', '周五'].map((label, i) => (
              <option key={i + 1} value={i + 1}>{label}</option>
            ))}
          </select>
        </div>
      )}

      {frequency === InvestFrequency.MONTHLY && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">每月几号</label>
          <input
            type="number"
            min="1"
            max="28"
            value={(config.day_of_month as number) || ''}
            onChange={(e) => update('day_of_month', Number(e.target.value))}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="1-28"
          />
        </div>
      )}
    </div>
  );
}
