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
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={loadData} />;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">仪表盘</h1>
      <PortfolioSummary positions={positions} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PositionList positions={positions} />
        </div>
        <div className="space-y-6">
          <RecentTransactions transactions={transactions} />
          <ActiveStrategies strategies={strategies} onUpdate={loadData} />
        </div>
      </div>
    </div>
  );
}
