import {
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { PositionAnalysisItem } from '../api/analytics';

interface PositionChartProps {
  data: PositionAnalysisItem[];
}

// 配色方案
const COLORS = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff8042',
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#845EC2',
  '#D65DB1',
  '#FF6F91',
  '#FF9671',
  '#FFC75F',
  '#F9F871',
];

/**
 * 持仓分布图组件
 *
 * 展示各基金的持仓占比和收益情况
 */
export default function PositionChart({ data }: PositionChartProps) {
  // 格式化金额显示
  const formatAmount = (value: number) => {
    return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // 格式化收益率显示
  const formatRate = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  // 准备图表数据
  const chartData = data.map((item) => ({
    name: item.fund_name || item.fund_code,
    code: item.fund_code,
    value: item.current_value,
    profit: item.profit,
    profit_rate: item.profit_rate,
    ratio: item.position_ratio * 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <PieChart>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis tickFormatter={formatAmount} />
        <Tooltip
          formatter={(value: number, name: string) => {
            if (name === 'value') {
              return [formatAmount(value), '持仓市值'];
            }
            return [value, name];
          }}
          labelFormatter={(label) => `基金：${label}`}
        />
        <Legend />
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={120}
          label={({ name, percent }) => `${name}: ${formatRate(percent)}`}
        >
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
