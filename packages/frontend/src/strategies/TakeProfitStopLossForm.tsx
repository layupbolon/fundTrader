interface TakeProfitStopLossFormProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

function rateToPercent(val: unknown): string {
  if (val == null) return '';
  return ((val as number) * 100).toFixed(0);
}

export default function TakeProfitStopLossForm({ config, onChange }: TakeProfitStopLossFormProps) {
  const takeProfit = (config.take_profit as Record<string, unknown>) || {};
  const stopLoss = (config.stop_loss as Record<string, unknown>) || {};

  function updateTakeProfit(field: string, value: unknown) {
    onChange({
      ...config,
      take_profit: { ...takeProfit, [field]: value },
    });
  }

  function updateStopLoss(field: string, value: unknown) {
    onChange({
      ...config,
      stop_loss: { ...stopLoss, [field]: value },
    });
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
            value={rateToPercent(takeProfit.target_rate)}
            onChange={(e) => updateTakeProfit('target_rate', Number(e.target.value) / 100)}
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
            value={rateToPercent(Math.abs(Number(stopLoss.max_drawdown ?? 0)))}
            onChange={(e) => updateStopLoss('max_drawdown', -Number(e.target.value) / 100)}
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
          value={rateToPercent(takeProfit.sell_ratio)}
          onChange={(e) => {
            const ratio = Number(e.target.value) / 100;
            updateTakeProfit('sell_ratio', ratio);
            updateStopLoss('sell_ratio', ratio);
          }}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          placeholder="例如 100"
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="trailing_stop"
          checked={takeProfit.trailing_stop != null}
          onChange={(e) =>
            updateTakeProfit(
              'trailing_stop',
              e.target.checked ? (takeProfit.trailing_stop ?? 0.05) : undefined,
            )
          }
          className="h-4 w-4 text-primary-600 rounded border-gray-300"
        />
        <label htmlFor="trailing_stop" className="text-sm text-gray-700">
          启用移动止盈
        </label>
      </div>

      {takeProfit.trailing_stop != null && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">移动止盈回撤率 (%)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={rateToPercent(takeProfit.trailing_stop)}
            onChange={(e) => updateTakeProfit('trailing_stop', Number(e.target.value) / 100)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="例如 5"
          />
        </div>
      )}
    </div>
  );
}
