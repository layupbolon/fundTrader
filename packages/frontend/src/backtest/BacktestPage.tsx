import { useState } from 'react';
import { runBacktest, fetchBacktestResults } from '../api/backtest';
import type { PaginatedResponse, BacktestResultData, BacktestPayload } from '../api/types';
import { useApi } from '../hooks/useApi';
import { usePagination } from '../hooks/usePagination';
import { ApiError } from '../api/client';
import BacktestForm from './BacktestForm';
import BacktestResultCard from './BacktestResultCard';
import Pagination from '../shared/Pagination';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import ErrorMessage from '../shared/ErrorMessage';

export default function BacktestPage() {
  const { page, limit, goToPage } = usePagination();
  const { data, loading, error, refetch } = useApi<PaginatedResponse<BacktestResultData>>(
    () => fetchBacktestResults(page, limit),
    [page, limit],
  );

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  async function handleSubmit(payload: BacktestPayload) {
    setSubmitting(true);
    setSubmitError('');
    try {
      await runBacktest(payload);
      refetch();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : '回测失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">策略回测</h1>

      <BacktestForm onSubmit={handleSubmit} loading={submitting} />

      {submitError && (
        <div className="p-3 bg-danger-50 text-danger-700 rounded-lg text-sm">{submitError}</div>
      )}

      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">历史回测结果</h2>

        {loading && <LoadingSpinner />}
        {error && <ErrorMessage message={error} onRetry={refetch} />}
        {data && data.data.length === 0 && <EmptyState message="暂无回测结果" />}
        {data && data.data.length > 0 && (
          <>
            <div className="space-y-4">
              {data.data.map((r) => (
                <BacktestResultCard key={r.id} result={r} />
              ))}
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} onPageChange={goToPage} />
          </>
        )}
      </div>
    </div>
  );
}
