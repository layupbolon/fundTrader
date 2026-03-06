import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchTransactions,
  refreshTransactionStatus,
  cancelTransaction,
  batchRefreshTransactionStatus,
  batchCancelTransactions,
} from '../api/transactions';
import type { Transaction } from '../api/types';
import { TransactionType, TransactionStatus } from '../api/types';
import { ApiError } from '../api/client';
import StatusBadge from '../shared/StatusBadge';
import Pagination from '../shared/Pagination';
import LoadingSpinner from '../shared/LoadingSpinner';
import ErrorMessage from '../shared/ErrorMessage';
import EmptyState from '../shared/EmptyState';

const PAGE_SIZE = 10;

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fundCode, setFundCode] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchResult, setBatchResult] = useState<{
    action: 'refresh' | 'cancel';
    total: number;
    success_count: number;
    failed_count: number;
    results: Array<{ id: string; success: boolean; message?: string; status?: string }>;
  } | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    action: 'single-cancel' | 'batch-cancel';
    transaction?: Transaction;
  }>({ open: false, action: 'single-cancel' });

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allOnPageSelected =
    transactions.length > 0 && transactions.every((tx) => selectedSet.has(tx.id));

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTransactions(page, PAGE_SIZE, {
        fundCode: fundCode.trim() || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setTransactions(res.data);
      setTotalPages(res.totalPages);
      setSelectedIds((prev) => prev.filter((id) => res.data.some((tx) => tx.id === id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载交易记录失败');
    } finally {
      setLoading(false);
    }
  }, [page, fundCode, typeFilter, statusFilter, startDate, endDate]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAllOnPage() {
    if (allOnPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !transactions.some((tx) => tx.id === id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...transactions.map((tx) => tx.id)])));
  }

  async function runSingleAction(action: 'refresh' | 'cancel', tx: Transaction) {
    setActionLoading(true);
    setError(null);
    setNotice(null);
    setBatchResult(null);
    try {
      if (action === 'refresh') {
        const result = await refreshTransactionStatus(tx.id);
        setNotice(`交易 ${tx.id.slice(0, 8)} 状态已刷新为 ${result.status}`);
      } else {
        const result = await cancelTransaction(tx.id);
        setNotice(`交易 ${tx.id.slice(0, 8)} 已撤销（${result.status}）`);
      }
      await loadTransactions();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '操作失败');
    } finally {
      setActionLoading(false);
    }
  }

  async function runBatchAction(action: 'refresh' | 'cancel') {
    if (selectedIds.length === 0) return;
    setActionLoading(true);
    setError(null);
    setNotice(null);
    setBatchResult(null);
    try {
      const result =
        action === 'refresh'
          ? await batchRefreshTransactionStatus(selectedIds)
          : await batchCancelTransactions(selectedIds);

      setNotice(
        `批量${action === 'refresh' ? '刷新' : '撤单'}完成：成功 ${result.success_count}，失败 ${result.failed_count}`,
      );
      setBatchResult({
        action,
        total: result.total,
        success_count: result.success_count,
        failed_count: result.failed_count,
        results: result.results.map((item) => ({
          id: item.id,
          success: item.success,
          message: item.message,
          status: item.status,
        })),
      });
      await loadTransactions();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '批量操作失败');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (error && transactions.length === 0) return <ErrorMessage message={error} onRetry={loadTransactions} />;

  function downloadBatchResultCsv() {
    if (!batchResult) return;
    const rows = [
      ['action', 'transaction_id', 'success', 'status', 'message'].join(','),
      ...batchResult.results.map((item) =>
        [
          batchResult.action,
          item.id,
          item.success ? 'true' : 'false',
          item.status || '',
          `"${(item.message || '').replace(/"/g, '""')}"`,
        ].join(','),
      ),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transaction-batch-result-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-gray-900">交易记录管理</h1>
        <div className="flex items-center gap-2">
          <input
            type="text"
            maxLength={6}
            value={fundCode}
            onChange={(e) => setFundCode(e.target.value.replace(/\D/g, ''))}
            placeholder="按基金代码筛选"
            className="w-44 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value="">全部类型</option>
            <option value={TransactionType.BUY}>买入</option>
            <option value={TransactionType.SELL}>卖出</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value="">全部状态</option>
            {Object.values(TransactionStatus).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
          <button
            onClick={() => {
              setPage(1);
              loadTransactions();
            }}
            className="px-3 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
          >
            查询
          </button>
          <button
            onClick={() => {
              setFundCode('');
              setTypeFilter('');
              setStatusFilter('');
              setStartDate('');
              setEndDate('');
              setPage(1);
            }}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            重置
          </button>
        </div>
      </div>

      {notice && <div className="p-3 text-sm rounded-lg bg-success-50 text-success-700">{notice}</div>}
      {error && <div className="p-3 text-sm rounded-lg bg-danger-50 text-danger-700">{error}</div>}
      {batchResult && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">批量操作结果明细</h2>
              <p className="text-xs text-gray-500 mt-1">
                总计 {batchResult.total}，成功 {batchResult.success_count}，失败 {batchResult.failed_count}
              </p>
            </div>
            <button
              onClick={downloadBatchResultCsv}
              className="px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded"
            >
              导出 CSV
            </button>
          </div>
          <div className="max-h-56 overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">交易ID</th>
                  <th className="px-3 py-2 text-left">结果</th>
                  <th className="px-3 py-2 text-left">状态</th>
                  <th className="px-3 py-2 text-left">消息</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {batchResult.results.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 font-mono text-gray-700">{item.id.slice(0, 12)}</td>
                    <td className="px-3 py-2">
                      <span className={item.success ? 'text-success-700' : 'text-danger-700'}>
                        {item.success ? '成功' : '失败'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{item.status || '-'}</td>
                    <td className="px-3 py-2 text-gray-500">{item.message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage} />
              全选当前页
            </label>
            <span className="text-sm text-gray-500">已选 {selectedIds.length} 笔</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => runBatchAction('refresh')}
              disabled={selectedIds.length === 0 || actionLoading}
              className="px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              批量刷新状态
            </button>
            <button
              onClick={() => setConfirmState({ open: true, action: 'batch-cancel' })}
              disabled={selectedIds.length === 0 || actionLoading}
              className="px-3 py-1.5 text-xs font-medium text-danger-700 bg-danger-50 hover:bg-danger-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              批量撤单
            </button>
          </div>
        </div>

        {transactions.length === 0 ? (
          <EmptyState message="暂无交易记录" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-2 text-left">选择</th>
                  <th className="px-4 py-2 text-left">基金</th>
                  <th className="px-4 py-2 text-left">类型</th>
                  <th className="px-4 py-2 text-left">金额</th>
                  <th className="px-4 py-2 text-left">状态</th>
                  <th className="px-4 py-2 text-left">提交时间</th>
                  <th className="px-4 py-2 text-left">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => {
                  const canCancel =
                    tx.status === TransactionStatus.PENDING || tx.status === TransactionStatus.SUBMITTED;
                  return (
                    <tr key={tx.id}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedSet.has(tx.id)}
                          onChange={() => toggleSelect(tx.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{tx.fund?.name || tx.fund_code}</div>
                        <div className="text-xs text-gray-400">{tx.fund_code}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            tx.type === TransactionType.BUY ? 'text-success-700 font-medium' : 'text-danger-700 font-medium'
                          }
                        >
                          {tx.type === TransactionType.BUY ? '买入' : '卖出'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        ¥
                        {tx.amount.toLocaleString('zh-CN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={tx.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(tx.submitted_at).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => runSingleAction('refresh', tx)}
                            disabled={actionLoading}
                            className="px-2 py-1 text-xs text-primary-700 bg-primary-50 hover:bg-primary-100 rounded disabled:opacity-50"
                          >
                            刷新状态
                          </button>
                          <button
                            onClick={() =>
                              setConfirmState({ open: true, action: 'single-cancel', transaction: tx })
                            }
                            disabled={!canCancel || actionLoading}
                            className="px-2 py-1 text-xs text-danger-700 bg-danger-50 hover:bg-danger-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            撤单
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {confirmState.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-2">确认操作</h3>
            <p className="text-sm text-gray-600 mb-5">
              {confirmState.action === 'single-cancel'
                ? `确定撤销交易 ${confirmState.transaction?.id.slice(0, 8)} 吗？`
                : `确定批量撤销已选择的 ${selectedIds.length} 笔交易吗？`}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmState((prev) => ({ ...prev, open: false }))}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  const action = confirmState.action;
                  const tx = confirmState.transaction;
                  setConfirmState((prev) => ({ ...prev, open: false }));
                  if (action === 'single-cancel' && tx) {
                    await runSingleAction('cancel', tx);
                  } else if (action === 'batch-cancel') {
                    await runBatchAction('cancel');
                  }
                }}
                className="flex-1 px-3 py-2 text-sm rounded-lg bg-danger-600 text-white hover:bg-danger-700"
              >
                确认撤单
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
