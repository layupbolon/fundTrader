import { useState, type FormEvent } from 'react';
import { StrategyType } from '../api/types';
import AutoInvestForm from '../strategies/AutoInvestForm';
import TakeProfitStopLossForm from '../strategies/TakeProfitStopLossForm';
import GridTradingForm from '../strategies/GridTradingForm';
import RebalanceForm from '../strategies/RebalanceForm';

const TYPE_LABELS: Record<StrategyType, string> = {
  [StrategyType.AUTO_INVEST]: '定投',
  [StrategyType.TAKE_PROFIT_STOP_LOSS]: '止盈止损',
  [StrategyType.GRID_TRADING]: '网格交易',
  [StrategyType.REBALANCE]: '再平衡',
};

interface BacktestFormProps {
  onSubmit: (params: {
    fund_code: string;
    start_date: string;
    end_date: string;
    initial_capital: number;
    strategy_config: Record<string, unknown>;
  }) => void;
  loading: boolean;
}

export default function BacktestForm({ onSubmit, loading }: BacktestFormProps) {
  const [fundCode, setFundCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [initialCapital, setInitialCapital] = useState<number>(10000);
  const [strategyType, setStrategyType] = useState<StrategyType>(StrategyType.AUTO_INVEST);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [error, setError] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!/^[0-9]{6}$/.test(fundCode)) {
      setError('基金代码必须为6位数字');
      return;
    }
    if (!startDate || !endDate) {
      setError('请选择回测日期范围');
      return;
    }
    if (new Date(startDate) >= new Date(endDate)) {
      setError('开始日期必须早于结束日期');
      return;
    }

    onSubmit({
      fund_code: fundCode,
      start_date: startDate,
      end_date: endDate,
      initial_capital: initialCapital,
      strategy_config: { type: strategyType, ...config },
    });
  }

  const ConfigForm = {
    [StrategyType.AUTO_INVEST]: AutoInvestForm,
    [StrategyType.TAKE_PROFIT_STOP_LOSS]: TakeProfitStopLossForm,
    [StrategyType.GRID_TRADING]: GridTradingForm,
    [StrategyType.REBALANCE]: RebalanceForm,
  }[strategyType];

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      {error && (
        <div className="p-3 bg-danger-50 text-danger-700 rounded-lg text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">基金代码</label>
          <input
            type="text"
            required
            maxLength={6}
            value={fundCode}
            onChange={(e) => setFundCode(e.target.value.replace(/\D/g, ''))}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="例如 110011"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">初始资金 (元)</label>
          <input
            type="number"
            required
            min="1"
            value={initialCapital}
            onChange={(e) => setInitialCapital(Number(e.target.value))}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
          <input
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">策略类型</label>
        <select
          value={strategyType}
          onChange={(e) => {
            setStrategyType(e.target.value as StrategyType);
            setConfig({});
          }}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        >
          {Object.entries(TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      <div className="border-t border-gray-200 pt-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">策略参数</h3>
        {ConfigForm && <ConfigForm config={config} onChange={setConfig} />}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '回测中...' : '开始回测'}
      </button>
    </form>
  );
}
