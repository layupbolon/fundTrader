import { TransactionStatus } from '../api/types';

const STATUS_STYLES: Record<TransactionStatus, { bg: string; text: string; label: string }> = {
  [TransactionStatus.PENDING]: { bg: 'bg-gray-100', text: 'text-gray-700', label: '待处理' },
  [TransactionStatus.SUBMITTED]: { bg: 'bg-blue-100', text: 'text-blue-700', label: '已提交' },
  [TransactionStatus.CONFIRMED]: { bg: 'bg-green-100', text: 'text-green-700', label: '已确认' },
  [TransactionStatus.FAILED]: { bg: 'bg-red-100', text: 'text-red-700', label: '失败' },
  [TransactionStatus.CANCELLED]: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '已取消' },
};

export default function StatusBadge({ status }: { status: TransactionStatus }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES[TransactionStatus.PENDING];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}
