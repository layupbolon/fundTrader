import { useState, useEffect, useCallback } from 'react';
import { fetchPositions } from '../api/positions';
import { fetchTransactions } from '../api/transactions';
import { fetchStrategies } from '../api/strategies';
import type { Position, Transaction, Strategy } from '../api/types';
import PortfolioSummary from './PortfolioSummary';
import PositionList from './PositionList';
import RecentTransactions from './RecentTransactions';
import ActiveStrategies from './ActiveStrategies';
import LoadingSpinner from '../shared/LoadingSpinner';
import ErrorMessage from '../shared/ErrorMessage';

export default function DashboardPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const [posRes, txRes, stratRes] = await Promise.all([
        fetchPositions(1, 50),
        fetchTransactions(1, 5),
        fetchStrategies(1, 50),
      ]);
      setPositions(posRes.data);
      setTransactions(txRes.data);
      setStrategies(stratRes.data);

      if (isRefresh) {
        setRefreshSuccess(true);
        setTimeout(() => setRefreshSuccess(false), 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={() => loadData()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">仪表盘</h1>
        <div className="flex items-center gap-3">
          {refreshSuccess && (
            <span className="text-sm text-success-600 bg-success-50 px-2 py-1 rounded">
              已刷新
            </span>
          )}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {refreshing ? '刷新中...' : '刷新'}
          </button>
        </div>
      </div>

      <PortfolioSummary positions={positions} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PositionList positions={positions} />
        </div>
        <div className="space-y-6">
          <RecentTransactions transactions={transactions} />
          <ActiveStrategies strategies={strategies} onUpdate={() => loadData(true)} />
        </div>
      </div>
    </div>
  );
}
