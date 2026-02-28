interface GridTradingFormProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

export default function GridTradingForm({ config, onChange }: GridTradingFormProps) {
  function update(field: string, value: unknown) {
    onChange({ ...config, [field]: value });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">价格上限</label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={(config.price_high as number) || ''}
            onChange={(e) => update('price_high', Number(e.target.value))}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="例如 2.500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">价格下限</label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={(config.price_low as number) || ''}
            onChange={(e) => update('price_low', Number(e.target.value))}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="例如 1.000"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">网格数量</label>
          <input
            type="number"
            min="2"
            max="100"
            value={(config.grid_count as number) || ''}
            onChange={(e) => update('grid_count', Number(e.target.value))}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="例如 10"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">每格金额 (元)</label>
          <input
            type="number"
            min="1"
            value={(config.amount_per_grid as number) || ''}
            onChange={(e) => update('amount_per_grid', Number(e.target.value))}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="例如 500"
          />
        </div>
      </div>
    </div>
  );
}
