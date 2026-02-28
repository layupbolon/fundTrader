import type { Position } from '../api/types';
import EmptyState from '../shared/EmptyState';

interface PositionListProps {
  positions: Position[];
}

export default function PositionList({ positions }: PositionListProps) {
  if (positions.length === 0) {
    return <EmptyState message="暂无持仓" />;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">持仓列表</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="px-5 py-3 font-medium">基金名称</th>
              <th className="px-5 py-3 font-medium">代码</th>
              <th className="px-5 py-3 font-medium text-right">份额</th>
              <th className="px-5 py-3 font-medium text-right">成本价</th>
              <th className="px-5 py-3 font-medium text-right">市值</th>
              <th className="px-5 py-3 font-medium text-right">收益率</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const profitColor = p.profit_rate >= 0 ? 'text-success-600' : 'text-danger-600';
              const sign = p.profit_rate >= 0 ? '+' : '';
              return (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">
                    {p.fund?.name || '-'}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{p.fund_code}</td>
                  <td className="px-5 py-3 text-right">{p.shares.toFixed(2)}</td>
                  <td className="px-5 py-3 text-right">¥{p.cost_basis.toFixed(4)}</td>
                  <td className="px-5 py-3 text-right">
                    ¥{p.market_value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-5 py-3 text-right font-medium ${profitColor}`}>
                    {sign}{(p.profit_rate * 100).toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
