import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ReturnsDataItem } from '../api/analytics';

interface ReturnChartProps {
  data: ReturnsDataItem[];
}

/**
 * 收益曲线图组件
 *
 * 展示总资产和总盈亏随时间变化的趋势
 */
export default function ReturnChart({ data }: ReturnChartProps) {
  // 格式化日期显示
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 格式化金额显示
  const formatAmount = (value: number) => {
    return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // 格式化收益率显示
  const formatRate = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          label={{ value: '日期', position: 'insideBottom', offset: -5 }}
        />
        <YAxis
          yAxisId="left"
          tickFormatter={formatAmount}
          label={{ value: '金额 (元)', angle: -90, position: 'insideLeft' }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickFormatter={formatRate}
          label={{ value: '收益率', angle: 90, position: 'insideRight' }}
        />
        <Tooltip
          formatter={(value: number, name: string) => {
            if (name === '收益率') {
              return [formatRate(value), name];
            }
            return [formatAmount(value), name];
          }}
          labelFormatter={(label) => `日期：${label}`}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="total_assets"
          name="总资产"
          stroke="#8884d8"
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="total_profit"
          name="总盈亏"
          stroke="#82ca9d"
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="total_profit_rate"
          name="收益率"
          stroke="#ffc658"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
