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
  });
});
