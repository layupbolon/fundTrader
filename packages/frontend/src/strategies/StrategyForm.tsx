import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StrategyType } from '../api/types';
import { createStrategy, updateStrategy, fetchStrategy } from '../api/strategies';
import { ApiError } from '../api/client';
import AutoInvestForm from './AutoInvestForm';
import TakeProfitStopLossForm from './TakeProfitStopLossForm';
import GridTradingForm from './GridTradingForm';
import RebalanceForm from './RebalanceForm';
import LoadingSpinner from '../shared/LoadingSpinner';

const TYPE_LABELS: Record<StrategyType, string> = {
  [StrategyType.AUTO_INVEST]: '定投',
  [StrategyType.TAKE_PROFIT_STOP_LOSS]: '止盈止损',
  [StrategyType.GRID_TRADING]: '网格交易',
  [StrategyType.REBALANCE]: '再平衡',
};

export default function StrategyForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [name, setName] = useState('');
  const [type, setType] = useState<StrategyType>(StrategyType.AUTO_INVEST);
  const [fundCode, setFundCode] = useState('');
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetchStrategy(id)
      .then((s) => {
        setName(s.name);
        setType(s.type);
        setFundCode(s.fund_code);
        setConfig(s.config);
        setEnabled(s.enabled);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setFetching(false));
  }, [id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!/^[0-9]{6}$/.test(fundCode)) {
      setError('基金代码必须为6位数字');
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        await updateStrategy(id, { name, config, enabled });
      } else {
        await createStrategy({ name, type, fund_code: fundCode, config, enabled });
      }
      navigate('/strategies');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  }

  if (fetching) return <LoadingSpinner />;

  const ConfigForm = {
    [StrategyType.AUTO_INVEST]: AutoInvestForm,
    [StrategyType.TAKE_PROFIT_STOP_LOSS]: TakeProfitStopLossForm,
    [StrategyType.GRID_TRADING]: GridTradingForm,
    [StrategyType.REBALANCE]: RebalanceForm,
  }[type];

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">
        {isEdit ? '编辑策略' : '新建策略'}
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-danger-50 text-danger-700 rounded-lg text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">策略名称</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="例如：沪深300定投"
          />
        </div>

        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">策略类型</label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as StrategyType);
                setConfig({});
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              {Object.entries(TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">基金代码</label>
          <input
            type="text"
            required
            maxLength={6}
            value={fundCode}
            onChange={(e) => setFundCode(e.target.value.replace(/\D/g, ''))}
            disabled={isEdit}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
            placeholder="6位数字，例如 110011"
          />
        </div>

        <div className="border-t border-gray-200 pt-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">策略配置</h2>
          {ConfigForm && <ConfigForm config={config} onChange={setConfig} />}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <input
            type="checkbox"
            id="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 text-primary-600 rounded border-gray-300"
          />
          <label htmlFor="enabled" className="text-sm text-gray-700">创建后立即启用</label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/strategies')}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '保存中...' : isEdit ? '保存修改' : '创建策略'}
          </button>
        </div>
      </form>
    </div>
  );
}
