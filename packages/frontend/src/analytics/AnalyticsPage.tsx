import { useState, useEffect } from 'react';
import { fetchReturnsData, fetchPositionAnalysis, fetchTransactionStats } from '../api/analytics';
import ReturnChart from './ReturnChart';
import PositionChart from './PositionChart';

/**
 * 分析页面
 *
 * 展示投资收益曲线、持仓分布和交易统计
 */
export default function AnalyticsPage() {
  // 日期范围状态
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // 数据状态
  const [returnsData, setReturnsData] = useState<Array<{
    date: string;
    total_assets: number;
    total_profit: number;
    total_profit_rate: number;
    position_count: number;
  }>>([]);
  const [positionData, setPositionData] = useState<Array<{
    fund_code: string;
    fund_name: string;
    current_value: number;
    position_ratio: number;
    profit: number;
    profit_rate: number;
  }>>([]);
  const [transactionData, setTransactionData] = useState<Array<{
    type: 'BUY' | 'SELL';
    count: number;
    total_amount: number;
    success_count: number;
    failed_count: number;
  }>>([]);

  // 加载状态
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 初始化日期范围（最近 3 个月）
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);

    const formatDate = (date: Date): string => {
      return date.toISOString().split('T')[0] ?? '';
    };

    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
  }, []);

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      if (!startDate || !endDate) return;

      setLoading(true);
      setError(null);

      try {
        const [returnsRes, positionRes, transactionRes] = await Promise.all([
          fetchReturnsData(startDate, endDate),
          fetchPositionAnalysis(),
          fetchTransactionStats(startDate, endDate),
        ]);

        setReturnsData(returnsRes.data);
        setPositionData(positionRes.data);
        setTransactionData(transactionRes.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载数据失败');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [startDate, endDate]);

  // 计算汇总数据
  const latestReturn = returnsData.length > 0 ? returnsData[returnsData.length - 1] : null;
  const totalPositionValue = positionData.reduce((sum, item) => sum + item.current_value, 0);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">收益分析</h1>

      {/* 汇总卡片 */}
      {latestReturn && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-500 text-sm mb-2">总资产</h3>
            <p className="text-2xl font-bold">
              ¥{latestReturn.total_assets.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-500 text-sm mb-2">总盈亏</h3>
            <p
              className={`text-2xl font-bold ${
                latestReturn.total_profit >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {latestReturn.total_profit >= 0 ? '+' : ''}
              ¥{latestReturn.total_profit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-500 text-sm mb-2">收益率</h3>
            <p
              className={`text-2xl font-bold ${
                latestReturn.total_profit_rate >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {(latestReturn.total_profit_rate * 100).toFixed(2)}%
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-500 text-sm mb-2">持仓市值</h3>
            <p className="text-2xl font-bold">
              ¥{totalPositionValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      {/* 日期选择器 */}
      <div className="bg-white rounded-lg shadow p-4 mb-8">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* 加载状态 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      ) : (
        <>
          {/* 收益曲线图 */}
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">收益走势</h2>
            {returnsData.length > 0 ? (
              <ReturnChart data={returnsData} />
            ) : (
              <p className="text-center text-gray-500 py-12">暂无数据</p>
            )}
          </div>

          {/* 持仓分布图 */}
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">持仓分布</h2>
            {positionData.length > 0 ? (
              <PositionChart data={positionData} />
            ) : (
              <p className="text-center text-gray-500 py-12">暂无持仓</p>
            )}
          </div>

          {/* 交易统计 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">交易统计</h2>
            {transactionData.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {transactionData.map((stat) => (
                  <div key={stat.type} className="border rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-3">
                      {stat.type === 'BUY' ? '买入' : '卖出'}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">交易次数</span>
                        <p className="text-lg font-semibold">{stat.count}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">交易金额</span>
                        <p className="text-lg font-semibold">
                          ¥{stat.total_amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">成功</span>
                        <p className="text-green-600 font-semibold">{stat.success_count}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">失败</span>
                        <p className="text-red-600 font-semibold">{stat.failed_count}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-12">暂无交易数据</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
