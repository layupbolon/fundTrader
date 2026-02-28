import { Link } from 'react-router-dom';
import { fetchStrategies } from '../api/strategies';
import type { PaginatedResponse, Strategy } from '../api/types';
import { useApi } from '../hooks/useApi';
import { usePagination } from '../hooks/usePagination';
import StrategyCard from './StrategyCard';
import Pagination from '../shared/Pagination';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import ErrorMessage from '../shared/ErrorMessage';

export default function StrategiesPage() {
  const { page, limit, goToPage } = usePagination();
  const { data, loading, error, refetch } = useApi<PaginatedResponse<Strategy>>(
    () => fetchStrategies(page, limit),
    [page, limit],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">策略管理</h1>
        <Link
          to="/strategies/new"
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
        >
          新建策略
        </Link>
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}
      {data && data.data.length === 0 && <EmptyState message={'暂无策略，点击「新建策略」开始创建'} />}
      {data && data.data.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.data.map((s) => (
              <StrategyCard key={s.id} strategy={s} onUpdate={refetch} />
            ))}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={goToPage} />
        </>
      )}
    </div>
  );
}
