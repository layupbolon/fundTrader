interface TakeProfitStopLossFormProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

function rateToPercent(val: unknown): string {
  if (val == null) return '';
  return ((val as number) * 100).toFixed(0);
}

export default function TakeProfitStopLossForm({ config, onChange }: TakeProfitStopLossFormProps) {
  function update(field: string, value: unknown) {
    onChange({ ...config, [field]: value });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">止盈率 (%)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={rateToPercent(config.take_profit_rate)}
            onChange={(e) => update('take_profit_rate', Number(e.target.value) / 100)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="例如 30"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">止损率 (%)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={rateToPercent(config.stop_loss_rate)}
            onChange={(e) => update('stop_loss_rate', Number(e.target.value) / 100)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="例如 10"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">卖出比例 (%)</label>
        <input
          type="number"
          step="1"
          min="1"
          max="100"
          value={rateToPercent(config.sell_ratio)}
          onChange={(e) => update('sell_ratio', Number(e.target.value) / 100)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          placeholder="例如 100"
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="trailing_stop"
          checked={!!config.trailing_stop}
          onChange={(e) => update('trailing_stop', e.target.checked)}
          className="h-4 w-4 text-primary-600 rounded border-gray-300"
        />
        <label htmlFor="trailing_stop" className="text-sm text-gray-700">
          启用移动止盈
        </label>
      </div>

      {!!config.trailing_stop && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">移动止盈回撤率 (%)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={rateToPercent(config.trailing_stop_rate)}
            onChange={(e) => update('trailing_stop_rate', Number(e.target.value) / 100)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="例如 5"
          />
        </div>
      )}
    </div>
  );
}
