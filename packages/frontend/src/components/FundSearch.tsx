import { useState, useEffect, useRef } from 'react';
import { fetchFunds } from '../api/funds';
import type { Fund } from '../api/types';

interface FundSearchProps {
  onSelect: (fund: Fund) => void;
  placeholder?: string;
  className?: string;
}

export default function FundSearch({ onSelect, placeholder = '搜索基金', className = '' }: FundSearchProps) {
  const [query, setQuery] = useState('');
  const [allFunds, setAllFunds] = useState<Fund[]>([]);
  const [results, setResults] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [fetched, setFetched] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 获取所有基金
  useEffect(() => {
    if (!fetched) {
      const fetch = async () => {
        setLoading(true);
        try {
          const data = await fetchFunds(1, 500);
          setAllFunds(data.data);
          setFetched(true);
        } catch (err) {
          console.error('获取基金列表失败:', err);
        } finally {
          setLoading(false);
        }
      };

      fetch();
    }
  }, [fetched]);

  // 本地搜索
  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const filtered = allFunds.filter((fund) => {
      const q = query.trim().toLowerCase();
      return (
        fund.code.includes(q) ||
        fund.name.toLowerCase().includes(q) ||
        fund.name.includes(query.trim())
      );
    });

    setResults(filtered.slice(0, 10));
    setIsOpen(filtered.length > 0);
  }, [query, allFunds]);

  // 点击外部关闭下拉
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(fund: Fund) {
    onSelect(fund);
    setQuery(`${fund.code} - ${fund.name}`);
    setIsOpen(false);
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim() && results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-auto">
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">加载中...</div>
          )}

          {!loading && results.length === 0 && query.trim() && (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">未找到匹配的基金</div>
          )}

          {!loading && results.map((fund) => (
            <button
              key={fund.id}
              onClick={() => handleSelect(fund)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-900">{fund.code}</span>
                  <span className="ml-2 text-sm text-gray-600">{fund.name}</span>
                </div>
                {fund.latest_nav && (
                  <span className="text-xs text-gray-400">净值：¥{fund.latest_nav.toFixed(4)}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
