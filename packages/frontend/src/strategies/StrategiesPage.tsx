import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchStrategies } from '../api/strategies';
import type { PaginatedResponse, Strategy, StrategyType } from '../api/types';
import { useApi } from '../hooks/useApi';
import { usePagination } from '../hooks/usePagination';
import StrategyCard from './StrategyCard';
import Pagination from '../shared/Pagination';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import ErrorMessage from '../shared/ErrorMessage';

type FilterStatus = 'all' | 'enabled' | 'disabled';

export default function StrategiesPage() {
  const { page, limit, goToPage } = usePagination();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterType, setFilterType] = useState<StrategyType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, loading, error, refetch } = useApi<PaginatedResponse<Strategy>>(
    () => fetchStrategies(page, limit),
    [page, limit],
  );

  // 前端筛选
  const filteredData = data
    ? {
        ...data,
        data: data.data.filter((strategy) => {
          // 状态筛选
          if (filterStatus === 'enabled' && !strategy.enabled) return false;
          if (filterStatus === 'disabled' && strategy.enabled) return false;

          // 类型筛选
          if (filterType !== 'all' && strategy.type !== filterType) return false;

          // 搜索
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchName = strategy.name.toLowerCase().includes(q);
            const matchFundCode = strategy.fund_code.includes(q);
            const matchFundName = strategy.fund?.name?.toLowerCase().includes(q);
            if (!matchName && !matchFundCode && !matchFundName) return false;
          }

          return true;
        }),
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-900">策略管理</h1>
        <Link
          to="/strategies/new"
          data-testid="new-strategy-button"
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
        >
          新建策略
        </Link>
      </div>

      {/* 筛选和搜索 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* 搜索框 */}
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="strategy-search-input"
              placeholder="搜索策略名称或基金代码..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          {/* 状态筛选 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 whitespace-nowrap">状态:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setFilterStatus('enabled')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  filterStatus === 'enabled'
                    ? 'bg-success-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                启用
              </button>
              <button
                onClick={() => setFilterStatus('disabled')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  filterStatus === 'disabled'
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                禁用
              </button>
            </div>
          </div>

          {/* 类型筛选 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 whitespace-nowrap">类型:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as StrategyType | 'all')}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
            >
              <option value="all">全部</option>
              <option value="auto_invest">定投</option>
              <option value="take_profit_stop_loss">止盈止损</option>
              <option value="grid_trading">网格交易</option>
              <option value="rebalance">再平衡</option>
            </select>
          </div>
        </div>
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}
      {filteredData && filteredData.data.length === 0 && (
        <EmptyState
          message={
            searchQuery || filterStatus !== 'all' || filterType !== 'all'
              ? '暂无匹配的策略'
              : '暂无策略，点击「新建策略」开始创建'
          }
        />
      )}
      {filteredData && filteredData.data.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredData.data.map((s) => (
              <StrategyCard key={s.id} strategy={s} onUpdate={refetch} />
            ))}
          </div>
          <Pagination
            page={filteredData.page}
            totalPages={filteredData.totalPages}
            onPageChange={goToPage}
          />
        </>
      )}
    </div>
  );
}
