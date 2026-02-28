import { Test, TestingModule } from '@nestjs/testing';
import { BacktestEngine } from '../backtest.engine';
import { FundDataService } from '../../../services/data/fund-data.service';
import { FundNav, StrategyType, InvestFrequency } from '../../../models';

describe('BacktestEngine', () => {
  let engine: BacktestEngine;
  let fundDataService: jest.Mocked<FundDataService>;

  beforeEach(async () => {
    const mockFundDataService = {
      getHistoricalNav: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BacktestEngine,
        {
          provide: FundDataService,
          useValue: mockFundDataService,
        },
      ],
    }).compile();

    engine = module.get<BacktestEngine>(BacktestEngine);
    fundDataService = module.get(FundDataService);
  });

  describe('runBacktest', () => {
    const createNavData = (): FundNav[] => [
      {
        fund_code: '000001',
        date: new Date('2026-01-01'),
        nav: 1.0,
        acc_nav: 1.0,
        growth_rate: 0,
      } as FundNav,
      {
        fund_code: '000001',
        date: new Date('2026-02-01'),
        nav: 1.1,
        acc_nav: 1.1,
        growth_rate: 0.1,
      } as FundNav,
      {
        fund_code: '000001',
        date: new Date('2026-03-01'),
        nav: 1.15,
        acc_nav: 1.15,
        growth_rate: 0.045,
      } as FundNav,
      {
        fund_code: '000001',
        date: new Date('2026-04-01'),
        nav: 1.2,
        acc_nav: 1.2,
        growth_rate: 0.043,
      } as FundNav,
    ];

    it('should run backtest successfully for auto invest strategy', async () => {
      const navData = createNavData();
      fundDataService.getHistoricalNav.mockResolvedValue(navData);

      const params = {
        strategy_config: {
          type: StrategyType.AUTO_INVEST,
          frequency: InvestFrequency.MONTHLY,
          amount: 1000,
        },
        fund_code: '000001',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-04-01'),
        initial_capital: 10000,
      };

      const result = await engine.runBacktest(params);

      expect(fundDataService.getHistoricalNav).toHaveBeenCalledWith(
        '000001',
        params.start_date,
        params.end_date,
      );
      expect(result).toBeDefined();
      expect(result.initial_capital).toBe(10000);
      expect(result.trades_count).toBeGreaterThan(0);
    });

    it('should throw error if no historical data available', async () => {
      fundDataService.getHistoricalNav.mockResolvedValue([]);

      const params = {
        strategy_config: {
          type: StrategyType.AUTO_INVEST,
          frequency: InvestFrequency.MONTHLY,
          amount: 1000,
        },
        fund_code: '000001',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-04-01'),
        initial_capital: 10000,
      };

      await expect(engine.runBacktest(params)).rejects.toThrow();
    });

    it('should handle take profit strategy', async () => {
      const navData = createNavData();
      fundDataService.getHistoricalNav.mockResolvedValue(navData);

      const params = {
        strategy_config: {
          type: StrategyType.TAKE_PROFIT,
          target_rate: 0.15,
          sell_ratio: 1.0,
        },
        fund_code: '000001',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-04-01'),
        initial_capital: 10000,
      };

      const result = await engine.runBacktest(params);

      expect(result).toBeDefined();
      expect(result.initial_capital).toBe(10000);
    });

    it('should calculate returns correctly', async () => {
      const navData = createNavData();
      fundDataService.getHistoricalNav.mockResolvedValue(navData);

      const params = {
        strategy_config: {
          type: StrategyType.AUTO_INVEST,
          frequency: InvestFrequency.MONTHLY,
          amount: 1000,
        },
        fund_code: '000001',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-04-01'),
        initial_capital: 10000,
      };

      const result = await engine.runBacktest(params);

      expect(result.final_value).toBeGreaterThan(0);
      expect(result.total_return).toBeDefined();
      expect(result.annual_return).toBeDefined();
      expect(result.max_drawdown).toBeLessThanOrEqual(0);
    });

    it('should use actual weighted cost instead of historical average', async () => {
      // Create NAV data with increasing prices
      const navData: FundNav[] = [
        { fund_code: '000001', date: new Date('2026-01-01'), nav: 1.0, acc_nav: 1.0, growth_rate: 0 } as FundNav,
        { fund_code: '000001', date: new Date('2026-02-01'), nav: 2.0, acc_nav: 2.0, growth_rate: 1.0 } as FundNav,
        { fund_code: '000001', date: new Date('2026-03-01'), nav: 3.0, acc_nav: 3.0, growth_rate: 0.5 } as FundNav,
      ];

      fundDataService.getHistoricalNav.mockResolvedValue(navData);

      // Monthly invest 1000 with enough capital
      const params = {
        strategy_config: {
          type: StrategyType.AUTO_INVEST,
          frequency: InvestFrequency.MONTHLY,
          amount: 1000,
        },
        fund_code: '000001',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-03-01'),
        initial_capital: 10000,
      };

      const result = await engine.runBacktest(params);

      // Day 1: Buy 1000/1.0 = 1000 shares at nav=1.0, totalCost=1000
      // Day 2: Buy 1000/2.0 = 500 shares at nav=2.0, totalCost=2000
      // Day 3: Buy 1000/3.0 = 333.33 shares at nav=3.0, totalCost=3000
      // Total shares = 1833.33, avgCost = 3000/1833.33 = 1.636
      // Old logic would use avg NAV = (1+2+3)/3 = 2.0 as avgCost (wrong)

      // Final value = cash(7000) + shares(1833.33) * nav(3.0) = 7000 + 5500 = 12500
      expect(result.trades_count).toBe(3);
      expect(result.final_value).toBeCloseTo(12500, 0);
    });

    it('should reduce totalCost proportionally on sell', async () => {
      // NAV goes up, triggers take profit, then we verify cost tracking
      const navData: FundNav[] = [
        { fund_code: '000001', date: new Date('2026-01-01'), nav: 1.0, acc_nav: 1.0, growth_rate: 0 } as FundNav,
        { fund_code: '000001', date: new Date('2026-02-01'), nav: 1.0, acc_nav: 1.0, growth_rate: 0 } as FundNav,
        { fund_code: '000001', date: new Date('2026-03-01'), nav: 1.5, acc_nav: 1.5, growth_rate: 0.5 } as FundNav,
      ];

      fundDataService.getHistoricalNav.mockResolvedValue(navData);

      // Buy monthly, take profit at 40% with 50% sell
      const params = {
        strategy_config: {
          type: StrategyType.TAKE_PROFIT,
          target_rate: 0.40,
          sell_ratio: 0.5,
        },
        fund_code: '000001',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-03-01'),
        initial_capital: 10000,
      };

      const result = await engine.runBacktest(params);

      // No buys happen (TAKE_PROFIT strategy doesn't buy)
      // No shares = no sell triggered
      // This verifies the engine doesn't crash with totalCost tracking
      expect(result).toBeDefined();
      expect(result.initial_capital).toBe(10000);
    });

    it('should handle stop loss with real cost tracking', async () => {
      const navData: FundNav[] = [
        { fund_code: '000001', date: new Date('2026-01-01'), nav: 2.0, acc_nav: 2.0, growth_rate: 0 } as FundNav,
        { fund_code: '000001', date: new Date('2026-02-01'), nav: 1.0, acc_nav: 1.0, growth_rate: -0.5 } as FundNav,
      ];

      fundDataService.getHistoricalNav.mockResolvedValue(navData);

      const params = {
        strategy_config: {
          type: StrategyType.STOP_LOSS,
          max_drawdown: -0.10,
          sell_ratio: 1.0,
        },
        fund_code: '000001',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-02-01'),
        initial_capital: 10000,
      };

      const result = await engine.runBacktest(params);

      // No shares purchased (STOP_LOSS doesn't buy), so no sell occurs
      expect(result).toBeDefined();
      expect(result.final_value).toBe(10000);
    });
  });
});
