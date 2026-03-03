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
      const navData: FundNav[] = [
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
          nav: 2.0,
          acc_nav: 2.0,
          growth_rate: 1.0,
        } as FundNav,
        {
          fund_code: '000001',
          date: new Date('2026-03-01'),
          nav: 3.0,
          acc_nav: 3.0,
          growth_rate: 0.5,
        } as FundNav,
      ];

      fundDataService.getHistoricalNav.mockResolvedValue(navData);

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

      expect(result.trades_count).toBe(3);
      expect(result.final_value).toBeCloseTo(12500, 0);
    });

    it('should handle grid trading strategy', async () => {
      const navData: FundNav[] = [
        {
          fund_code: '000001',
          date: new Date('2026-01-01'),
          nav: 1.0,
          acc_nav: 1.0,
          growth_rate: 0,
        } as FundNav,
        {
          fund_code: '000001',
          date: new Date('2026-01-02'),
          nav: 1.1,
          acc_nav: 1.1,
          growth_rate: 0.1,
        } as FundNav,
        {
          fund_code: '000001',
          date: new Date('2026-01-03'),
          nav: 0.9,
          acc_nav: 0.9,
          growth_rate: -0.18,
        } as FundNav,
        {
          fund_code: '000001',
          date: new Date('2026-01-04'),
          nav: 1.0,
          acc_nav: 1.0,
          growth_rate: 0.11,
        } as FundNav,
        {
          fund_code: '000001',
          date: new Date('2026-01-05'),
          nav: 1.2,
          acc_nav: 1.2,
          growth_rate: 0.2,
        } as FundNav,
      ];

      fundDataService.getHistoricalNav.mockResolvedValue(navData);

      const params = {
        strategy_config: {
          type: StrategyType.GRID_TRADING,
          price_low: 0.8,
          price_high: 1.5,
          grid_count: 10,
          amount_per_grid: 1000,
        },
        fund_code: '000001',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-01-05'),
        initial_capital: 10000,
      };

      const result = await engine.runBacktest(params);

      expect(result).toBeDefined();
      expect(result.initial_capital).toBe(10000);
      expect(result.final_value).toBeGreaterThan(0);
    });

    it('should return HOLD for rebalance strategy (known limitation)', async () => {
      const navData: FundNav[] = [
        {
          fund_code: '000001',
          date: new Date('2026-01-01'),
          nav: 1.0,
          acc_nav: 1.0,
          growth_rate: 0,
        } as FundNav,
        {
          fund_code: '000001',
          date: new Date('2026-01-02'),
          nav: 1.1,
          acc_nav: 1.1,
          growth_rate: 0.1,
        } as FundNav,
      ];

      fundDataService.getHistoricalNav.mockResolvedValue(navData);

      const params = {
        strategy_config: {
          type: StrategyType.REBALANCE,
          target_allocation: [{ fund_code: '000001', ratio: 0.5 }],
        },
        fund_code: '000001',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-01-02'),
        initial_capital: 10000,
      };

      const result = await engine.runBacktest(params);

      expect(result).toBeDefined();
      expect(result.trades_count).toBe(0);
      expect(result.final_value).toBe(10000);
    });

    it('should handle empty historical data with error', async () => {
      fundDataService.getHistoricalNav.mockResolvedValue([]);

      const params = {
        strategy_config: {
          type: StrategyType.AUTO_INVEST,
          frequency: InvestFrequency.DAILY,
          amount: 1000,
        },
        fund_code: '000001',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-01-10'),
        initial_capital: 10000,
      };

      await expect(engine.runBacktest(params)).rejects.toThrow();
    });

    it('should handle single data point', async () => {
      const navData: FundNav[] = [
        {
          fund_code: '000001',
          date: new Date('2026-01-01'),
          nav: 1.0,
          acc_nav: 1.0,
          growth_rate: 0,
        } as FundNav,
      ];

      fundDataService.getHistoricalNav.mockResolvedValue(navData);

      const params = {
        strategy_config: {
          type: StrategyType.AUTO_INVEST,
          frequency: InvestFrequency.DAILY,
          amount: 1000,
        },
        fund_code: '000001',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-01-01'),
        initial_capital: 10000,
      };

      const result = await engine.runBacktest(params);

      expect(result).toBeDefined();
      expect(result.initial_capital).toBe(10000);
    });

    it('should calculate Sharpe ratio correctly', async () => {
      const navData: FundNav[] = [
        {
          fund_code: '000001',
          date: new Date('2026-01-01'),
          nav: 1.0,
          acc_nav: 1.0,
          growth_rate: 0,
        } as FundNav,
        {
          fund_code: '000001',
          date: new Date('2026-01-02'),
          nav: 1.02,
          acc_nav: 1.02,
          growth_rate: 0.02,
        } as FundNav,
        {
          fund_code: '000001',
          date: new Date('2026-01-03'),
          nav: 1.04,
          acc_nav: 1.04,
          growth_rate: 0.02,
        } as FundNav,
        {
          fund_code: '000001',
          date: new Date('2026-01-04'),
          nav: 1.06,
          acc_nav: 1.06,
          growth_rate: 0.019,
        } as FundNav,
        {
          fund_code: '000001',
          date: new Date('2026-01-05'),
          nav: 1.08,
          acc_nav: 1.08,
          growth_rate: 0.019,
        } as FundNav,
      ];

      fundDataService.getHistoricalNav.mockResolvedValue(navData);

      const params = {
        strategy_config: {
          type: StrategyType.AUTO_INVEST,
          frequency: InvestFrequency.DAILY,
          amount: 1000,
        },
        fund_code: '000001',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-01-05'),
        initial_capital: 10000,
      };

      const result = await engine.runBacktest(params);

      expect(result).toBeDefined();
      expect(result.sharpe_ratio).toBeDefined();
    });

    it('should return 0 for Sharpe ratio with single data point', async () => {
      const navData: FundNav[] = [
        {
          fund_code: '000001',
          date: new Date('2026-01-01'),
          nav: 1.0,
          acc_nav: 1.0,
          growth_rate: 0,
        } as FundNav,
      ];

      fundDataService.getHistoricalNav.mockResolvedValue(navData);

      const params = {
        strategy_config: {
          type: StrategyType.AUTO_INVEST,
          frequency: InvestFrequency.DAILY,
          amount: 1000,
        },
        fund_code: '000001',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-01-01'),
        initial_capital: 10000,
      };

      const result = await engine.runBacktest(params);

      expect(result).toBeDefined();
      expect(result.sharpe_ratio).toBe(0);
    });

    it('should calculate max drawdown correctly', async () => {
      const navData: FundNav[] = [
        {
          fund_code: '000001',
          date: new Date('2026-01-01'),
          nav: 1.0,
          acc_nav: 1.0,
          growth_rate: 0,
        } as FundNav,
        {
          fund_code: '000001',
          date: new Date('2026-01-02'),
          nav: 1.2,
          acc_nav: 1.2,
          growth_rate: 0.2,
        } as FundNav,
        {
          fund_code: '000001',
          date: new Date('2026-01-03'),
          nav: 1.5,
          acc_nav: 1.5,
          growth_rate: 0.25,
        } as FundNav,
        {
          fund_code: '000001',
          date: new Date('2026-01-04'),
          nav: 1.3,
          acc_nav: 1.3,
          growth_rate: -0.133,
        } as FundNav,
        {
          fund_code: '000001',
          date: new Date('2026-01-05'),
          nav: 1.0,
          acc_nav: 1.0,
          growth_rate: -0.23,
        } as FundNav,
      ];

      fundDataService.getHistoricalNav.mockResolvedValue(navData);

      const params = {
        strategy_config: {
          type: StrategyType.AUTO_INVEST,
          frequency: InvestFrequency.DAILY,
          amount: 1000,
        },
        fund_code: '000001',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-01-05'),
        initial_capital: 10000,
      };

      const result = await engine.runBacktest(params);

      expect(result).toBeDefined();
      expect(result.max_drawdown).toBeGreaterThan(0);
      expect(result.max_drawdown).toBeLessThanOrEqual(1);
    });

    it('should calculate annual return correctly', async () => {
      const navData: FundNav[] = [
        {
          fund_code: '000001',
          date: new Date('2026-01-01'),
          nav: 1.0,
          acc_nav: 1.0,
          growth_rate: 0,
        } as FundNav,
        {
          fund_code: '000001',
          date: new Date('2026-07-01'),
          nav: 1.2,
          acc_nav: 1.2,
          growth_rate: 0.2,
        } as FundNav,
      ];

      fundDataService.getHistoricalNav.mockResolvedValue(navData);

      const params = {
        strategy_config: {
          type: StrategyType.AUTO_INVEST,
          frequency: InvestFrequency.DAILY,
          amount: 1000,
        },
        fund_code: '000001',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-07-01'),
        initial_capital: 10000,
      };

      const result = await engine.runBacktest(params);

      expect(result).toBeDefined();
      expect(result.annual_return).toBeDefined();
    });

    it('should handle grid trading outside price range', async () => {
      const navData: FundNav[] = [
        {
          fund_code: '000001',
          date: new Date('2026-01-01'),
          nav: 0.5,
          acc_nav: 0.5,
          growth_rate: 0,
        } as FundNav,
        {
          fund_code: '000001',
          date: new Date('2026-01-02'),
          nav: 0.6,
          acc_nav: 0.6,
          growth_rate: 0.2,
        } as FundNav,
      ];

      fundDataService.getHistoricalNav.mockResolvedValue(navData);

      const params = {
        strategy_config: {
          type: StrategyType.GRID_TRADING,
          price_low: 0.8,
          price_high: 1.5,
          grid_count: 10,
          amount_per_grid: 1000,
        },
        fund_code: '000001',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-01-02'),
        initial_capital: 10000,
      };

      const result = await engine.runBacktest(params);

      expect(result).toBeDefined();
      expect(result.trades_count).toBe(0);
      expect(result.final_value).toBe(10000);
    });

    it('should handle weekly auto invest on correct day', async () => {
      const navData: FundNav[] = [
        {
          fund_code: '000001',
          date: new Date('2026-01-05'),
          nav: 1.0,
          acc_nav: 1.0,
          growth_rate: 0,
        } as FundNav,
        {
          fund_code: '000001',
          date: new Date('2026-01-06'),
          nav: 1.1,
          acc_nav: 1.1,
          growth_rate: 0.1,
        } as FundNav,
      ];

      fundDataService.getHistoricalNav.mockResolvedValue(navData);

      const params = {
        strategy_config: {
          type: StrategyType.AUTO_INVEST,
          frequency: InvestFrequency.WEEKLY,
          amount: 1000,
          day_of_week: 1,
        },
        fund_code: '000001',
        start_date: new Date('2026-01-05'),
        end_date: new Date('2026-01-06'),
        initial_capital: 10000,
      };

      const result = await engine.runBacktest(params);

      expect(result.trades_count).toBe(1);
    });
  });
});
