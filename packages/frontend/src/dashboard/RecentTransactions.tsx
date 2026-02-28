import type { Transaction } from '../api/types';
import { TransactionType } from '../api/types';
import StatusBadge from '../shared/StatusBadge';
import EmptyState from '../shared/EmptyState';

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export default function RecentTransactions({ transactions }: RecentTransactionsProps) {
  if (transactions.length === 0) {
    return <EmptyState message="暂无交易记录" />;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">最近交易</h2>
      </div>
      <div className="divide-y divide-gray-50">
        {transactions.map((tx) => (
          <div key={tx.id} className="px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                  tx.type === TransactionType.BUY
                    ? 'bg-success-50 text-success-700'
                    : 'bg-danger-50 text-danger-700'
                }`}
              >
                {tx.type === TransactionType.BUY ? '买' : '卖'}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {tx.fund?.name || tx.fund_code}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(tx.submitted_at).toLocaleDateString('zh-CN')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-900">
                ¥{tx.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <StatusBadge status={tx.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
