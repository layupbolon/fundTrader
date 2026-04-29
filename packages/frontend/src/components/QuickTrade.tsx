import { useState } from 'react';
import { createTransaction } from '../api/transactions';
import { TransactionType } from '../api/types';
import { ApiError } from '../api/client';

interface QuickTradeProps {
  fundCode: string;
  fundName?: string;
  onSuccess?: () => void;
}

export default function QuickTrade({ fundCode, fundName, onSuccess }: QuickTradeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tradeType, setTradeType] = useState<TransactionType>(TransactionType.BUY);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    const tradeAmount = parseFloat(amount);
    if (isNaN(tradeAmount) || tradeAmount <= 0) {
      setError('请输入有效的交易金额');
      return;
    }

    setLoading(true);
    try {
      await createTransaction({
        fund_code: fundCode,
        type: tradeType,
        amount: tradeAmount,
      });
      setSuccess(true);
      setAmount('');
      onSuccess?.();

      // 3 秒后自动关闭
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '交易失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
      >
        快捷交易
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">快捷交易</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {fundName && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">交易基金</p>
                <p className="text-sm font-medium text-gray-900">
                  {fundName} ({fundCode})
                </p>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-success-50 text-success-700 rounded-lg text-sm">
                交易提交成功！
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-danger-50 text-danger-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">交易类型</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTradeType(TransactionType.BUY)}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      tradeType === TransactionType.BUY
                        ? 'bg-success-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    买入
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradeType(TransactionType.SELL)}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      tradeType === TransactionType.SELL
                        ? 'bg-danger-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    卖出
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">交易金额</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">¥</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0.01"
                    step="0.01"
                    required
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? '提交中...' : '确认交易'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
