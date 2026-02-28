import type { BacktestResultData } from '../api/types';

interface BacktestResultCardProps {
  result: BacktestResultData;
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${color || 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

export default function BacktestResultCard({ result }: BacktestResultCardProps) {
  const returnColor = result.total_return >= 0 ? 'text-success-600' : 'text-danger-600';
  const annualColor = result.annual_return >= 0 ? 'text-success-600' : 'text-danger-600';
  const returnSign = result.total_return >= 0 ? '+' : '';
  const annualSign = result.annual_return >= 0 ? '+' : '';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">基金 {result.fund_code}</p>
          <p className="text-xs text-gray-400">
            {new Date(result.start_date).toLocaleDateString('zh-CN')} ~{' '}
            {new Date(result.end_date).toLocaleDateString('zh-CN')}
          </p>
        </div>
        <p className="text-xs text-gray-400">
          初始资金 ¥{result.initial_capital.toLocaleString('zh-CN')}
        </p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
        <Metric
          label="总收益率"
          value={`${returnSign}${(result.total_return * 100).toFixed(2)}%`}
          color={returnColor}
        />
        <Metric
          label="年化收益"
          value={`${annualSign}${(result.annual_return * 100).toFixed(2)}%`}
          color={annualColor}
        />
        <Metric
          label="最大回撤"
          value={`${(result.max_drawdown * 100).toFixed(2)}%`}
          color="text-danger-600"
        />
        <Metric
          label="夏普比率"
          value={result.sharpe_ratio.toFixed(2)}
        />
        <Metric
          label="交易次数"
          value={String(result.trades_count)}
        />
        <Metric
          label="最终价值"
          value={`¥${result.final_value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
      </div>
    </div>
  );
}
