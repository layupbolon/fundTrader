import type { Position } from '../api/types';

interface PortfolioSummaryProps {
  positions: Position[];
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function PortfolioSummary({ positions }: PortfolioSummaryProps) {
  const totalMarketValue = positions.reduce((sum, p) => sum + p.market_value, 0);
  const totalCost = positions.reduce((sum, p) => sum + p.cost_basis * p.shares, 0);
  const totalProfit = totalMarketValue - totalCost;
  const totalProfitRate = totalCost > 0 ? totalProfit / totalCost : 0;

  const profitColor = totalProfit >= 0 ? 'text-success-600' : 'text-danger-600';
  const profitSign = totalProfit >= 0 ? '+' : '';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="总市值"
        value={`¥${totalMarketValue.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        sub={`${positions.length} 只基金`}
      />
      <StatCard
        label="总成本"
        value={`¥${totalCost.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      />
      <StatCard
        label="总盈亏"
        value={`${profitSign}¥${Math.abs(totalProfit).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        color={profitColor}
      />
      <StatCard
        label="总收益率"
        value={`${profitSign}${(totalProfitRate * 100).toFixed(2)}%`}
        color={profitColor}
      />
    </div>
  );
}
