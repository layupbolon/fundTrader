import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GridTradingStrategy } from '../grid-trading.strategy';
import { Strategy, Transaction, StrategyType, TransactionType, TransactionStatus } from '../../../models';
import { TiantianBrokerService } from '../../../services/broker/tiantian.service';
import { FundDataService } from '../../../services/data/fund-data.service';
import { NotifyService } from '../../../services/notify/notify.service';

// Mock isTradeTime
jest.mock('../../../utils', () => ({
  isTradeTime: jest.fn(() => true),
}));

import { isTradeTime } from '../../../utils';

describe('GridTradingStrategy', () => {
  let strategy: GridTradingStrategy;
  let strategyRepository: any;
  let transactionRepository: any;
  let fundDataService: jest.Mocked<FundDataService>;
  let brokerService: jest.Mocked<TiantianBrokerService>;
  let notifyService: jest.Mocked<NotifyService>;

  const mockStrategy: Partial<Strategy> = {
    id: 'strategy-1',
    user_id: 'user-1',
    fund_code: '110011',
    type: StrategyType.GRID_TRADING,
    enabled: true,
    config: {
      price_low: 1.0,
      price_high: 2.0,
      grid_count: 5,
      amount_per_grid: 500,
    },
  };

  beforeEach(async () => {
    strategyRepository = {
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
    };

    transactionRepository = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'tx-1', ...data })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GridTradingStrategy,
        { provide: getRepositoryToken(Strategy), useValue: strategyRepository },
        { provide: getRepositoryToken(Transaction), useValue: transactionRepository },
        {
          provide: FundDataService,
          useValue: { getFundNav: jest.fn() },
        },
        {
          provide: TiantianBrokerService,
          useValue: { buyFund: jest.fn(), sellFund: jest.fn() },
        },
        {
          provide: NotifyService,
          useValue: { send: jest.fn() },
        },
      ],
    }).compile();

    strategy = module.get<GridTradingStrategy>(GridTradingStrategy);
    fundDataService = module.get(FundDataService);
    brokerService = module.get(TiantianBrokerService);
    notifyService = module.get(NotifyService);
  });

  describe('getGridLines', () => {
    it('should compute evenly spaced grid lines', () => {
      const lines = strategy.getGridLines({
        price_low: 1.0, price_high: 2.0, grid_count: 5, amount_per_grid: 500,
      });

      expect(lines).toHaveLength(6); // grid_count + 1
      expect(lines[0]).toBeCloseTo(1.0);
      expect(lines[5]).toBeCloseTo(2.0);
      expect(lines[1]).toBeCloseTo(1.2);
    });
  });

  describe('getCurrentGridLevel', () => {
    it('should return correct level for given NAV', () => {
      const lines = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0];

      expect(strategy.getCurrentGridLevel(1.0, lines)).toBe(0);
      expect(strategy.getCurrentGridLevel(1.3, lines)).toBe(1);
      expect(strategy.getCurrentGridLevel(1.99, lines)).toBe(4);
      expect(strategy.getCurrentGridLevel(2.0, lines)).toBe(5);
    });

    it('should return 0 for NAV below all grid lines', () => {
      const lines = [1.0, 1.2, 1.4];
      expect(strategy.getCurrentGridLevel(0.5, lines)).toBe(0);
    });
  });

  describe('shouldExecute', () => {
    it('should return false when strategy is disabled', async () => {
      const result = await strategy.shouldExecute({
        ...mockStrategy, enabled: false,
      } as Strategy);
      expect(result).toBe(false);
    });

    it('should return false when not trade time', async () => {
      (isTradeTime as jest.Mock).mockReturnValue(false);
      const result = await strategy.shouldExecute(mockStrategy as Strategy);
      expect(result).toBe(false);
      (isTradeTime as jest.Mock).mockReturnValue(true);
    });

    it('should return false when NAV is outside grid range', async () => {
      fundDataService.getFundNav.mockResolvedValue({ nav: 3.0 } as any);
      const result = await strategy.shouldExecute(mockStrategy as Strategy);
      expect(result).toBe(false);
    });

    it('should return true when no last_grid_level set', async () => {
      fundDataService.getFundNav.mockResolvedValue({ nav: 1.5 } as any);
      const result = await strategy.shouldExecute(mockStrategy as Strategy);
      expect(result).toBe(true);
    });

    it('should return true when grid level changed', async () => {
      fundDataService.getFundNav.mockResolvedValue({ nav: 1.5 } as any);
      const s = {
        ...mockStrategy,
        config: { ...mockStrategy.config, last_grid_level: 0 },
      } as Strategy;
      const result = await strategy.shouldExecute(s);
      expect(result).toBe(true);
    });

    it('should return false when grid level unchanged', async () => {
      fundDataService.getFundNav.mockResolvedValue({ nav: 1.1 } as any);
      const s = {
        ...mockStrategy,
        config: { ...mockStrategy.config, last_grid_level: 0 },
      } as Strategy;
      const result = await strategy.shouldExecute(s);
      expect(result).toBe(false);
    });
  });

  describe('execute', () => {
    it('should BUY when NAV crosses grid downward', async () => {
      fundDataService.getFundNav.mockResolvedValue({ nav: 1.1 } as any);
      brokerService.buyFund.mockResolvedValue({ id: 'order-1', fundCode: '110011', amount: 500, status: 'PENDING' });

      const s = {
        ...mockStrategy,
        config: { ...mockStrategy.config, last_grid_level: 2 },
      } as Strategy;

      const result = await strategy.execute(s);

      expect(result).not.toBeNull();
      expect(brokerService.buyFund).toHaveBeenCalledWith('110011', 500);
      expect(transactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: TransactionType.BUY, amount: 500 }),
      );
    });

    it('should SELL when NAV crosses grid upward', async () => {
      fundDataService.getFundNav.mockResolvedValue({ nav: 1.9 } as any);
      brokerService.sellFund.mockResolvedValue({ id: 'order-2', fundCode: '110011', amount: 500, status: 'PENDING' });

      const s = {
        ...mockStrategy,
        config: { ...mockStrategy.config, last_grid_level: 0 },
      } as Strategy;

      const result = await strategy.execute(s);

      expect(result).not.toBeNull();
      expect(brokerService.sellFund).toHaveBeenCalled();
      expect(transactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: TransactionType.SELL }),
      );
    });

    it('should send error notification on failure', async () => {
      fundDataService.getFundNav.mockResolvedValue({ nav: 1.5 } as any);
      brokerService.buyFund.mockRejectedValue(new Error('交易失败'));

      const s = {
        ...mockStrategy,
        config: { ...mockStrategy.config, last_grid_level: 4 },
      } as Strategy;

      await expect(strategy.execute(s)).rejects.toThrow('交易失败');
      expect(notifyService.send).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error' }),
      );
    });
  });
});
