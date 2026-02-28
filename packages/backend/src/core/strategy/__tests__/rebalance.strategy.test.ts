import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RebalanceStrategy } from '../rebalance.strategy';
import {
  Strategy,
  Position,
  Transaction,
  StrategyType,
  TransactionType,
  TransactionStatus,
  InvestFrequency,
} from '../../../models';
import { TiantianBrokerService } from '../../../services/broker/tiantian.service';
import { FundDataService } from '../../../services/data/fund-data.service';
import { NotifyService } from '../../../services/notify/notify.service';

jest.mock('../../../utils', () => ({
  isTradeTime: jest.fn(() => true),
  isWorkday: jest.fn(() => true),
}));

import { isTradeTime, isWorkday } from '../../../utils';

describe('RebalanceStrategy', () => {
  let strategy: RebalanceStrategy;
  let strategyRepository: any;
  let positionRepository: any;
  let transactionRepository: any;
  let fundDataService: jest.Mocked<FundDataService>;
  let brokerService: jest.Mocked<TiantianBrokerService>;
  let notifyService: jest.Mocked<NotifyService>;

  const mockStrategy: Partial<Strategy> = {
    id: 'strategy-1',
    user_id: 'user-1',
    fund_code: '110011',
    type: StrategyType.REBALANCE,
    enabled: true,
    config: {
      target_allocations: [
        { fund_code: '110011', target_weight: 0.6 },
        { fund_code: '000001', target_weight: 0.4 },
      ],
      rebalance_threshold: 0.05,
      frequency: InvestFrequency.MONTHLY,
    },
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-01T10:00:00')); // 1st of month, Monday

    strategyRepository = {
      update: jest.fn().mockResolvedValue(undefined),
    };

    positionRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };

    transactionRepository = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'tx-1', ...data })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RebalanceStrategy,
        { provide: getRepositoryToken(Strategy), useValue: strategyRepository },
        { provide: getRepositoryToken(Position), useValue: positionRepository },
        { provide: getRepositoryToken(Transaction), useValue: transactionRepository },
        { provide: FundDataService, useValue: { getFundNav: jest.fn() } },
        { provide: TiantianBrokerService, useValue: { buyFund: jest.fn(), sellFund: jest.fn() } },
        { provide: NotifyService, useValue: { send: jest.fn() } },
      ],
    }).compile();

    strategy = module.get<RebalanceStrategy>(RebalanceStrategy);
    fundDataService = module.get(FundDataService);
    brokerService = module.get(TiantianBrokerService);
    notifyService = module.get(NotifyService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getCurrentAllocations', () => {
    it('should compute weights from positions and NAV', async () => {
      positionRepository.find.mockResolvedValue([
        { fund_code: '110011', shares: 100 },
        { fund_code: '000001', shares: 200 },
      ]);
      fundDataService.getFundNav
        .mockResolvedValueOnce({ nav: 2.0 } as any) // 110011: 200
        .mockResolvedValueOnce({ nav: 1.0 } as any); // 000001: 200

      const result = await strategy.getCurrentAllocations('user-1', ['110011', '000001']);

      expect(result['110011']).toBeCloseTo(0.5);
      expect(result['000001']).toBeCloseTo(0.5);
    });

    it('should return zero allocations when no positions', async () => {
      positionRepository.find.mockResolvedValue([]);
      fundDataService.getFundNav.mockResolvedValue(null);

      const result = await strategy.getCurrentAllocations('user-1', ['110011', '000001']);

      expect(result['110011']).toBe(0);
      expect(result['000001']).toBe(0);
    });
  });

  describe('computeRebalanceOrders', () => {
    it('should generate BUY/SELL orders when deviation exceeds threshold', () => {
      const current = { '110011': 0.4, '000001': 0.6 };
      const targets = [
        { fund_code: '110011', target_weight: 0.6 },
        { fund_code: '000001', target_weight: 0.4 },
      ];

      const orders = strategy.computeRebalanceOrders(current, targets, 10000, 0.05);

      expect(orders).toHaveLength(2);
      const buyOrder = orders.find((o) => o.fund_code === '110011');
      const sellOrder = orders.find((o) => o.fund_code === '000001');
      expect(buyOrder?.action).toBe('BUY');
      expect(sellOrder?.action).toBe('SELL');
      expect(buyOrder?.amount).toBeCloseTo(2000);
      expect(sellOrder?.amount).toBeCloseTo(2000);
    });

    it('should not generate orders when deviation is below threshold', () => {
      const current = { '110011': 0.59, '000001': 0.41 };
      const targets = [
        { fund_code: '110011', target_weight: 0.6 },
        { fund_code: '000001', target_weight: 0.4 },
      ];

      const orders = strategy.computeRebalanceOrders(current, targets, 10000, 0.05);
      expect(orders).toHaveLength(0);
    });

    it('should handle missing fund in current allocations', () => {
      const current = { '110011': 1.0 };
      const targets = [
        { fund_code: '110011', target_weight: 0.5 },
        { fund_code: '000001', target_weight: 0.5 },
      ];

      const orders = strategy.computeRebalanceOrders(current, targets, 10000, 0.05);
      expect(orders).toHaveLength(2);
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
      (isTradeTime as jest.Mock).mockReturnValueOnce(false);
      const result = await strategy.shouldExecute(mockStrategy as Strategy);
      expect(result).toBe(false);
    });

    it('should return false when frequency does not match day', async () => {
      // Set to 2nd of month - MONTHLY check on 1st
      jest.setSystemTime(new Date('2026-03-02T10:00:00'));
      const result = await strategy.shouldExecute(mockStrategy as Strategy);
      expect(result).toBe(false);
    });

    it('should check deviations and return true when threshold exceeded', async () => {
      positionRepository.find.mockResolvedValue([
        { fund_code: '110011', shares: 100 },
        { fund_code: '000001', shares: 100 },
      ]);
      fundDataService.getFundNav
        .mockResolvedValueOnce({ nav: 1.0 } as any)
        .mockResolvedValueOnce({ nav: 1.0 } as any);

      const result = await strategy.shouldExecute(mockStrategy as Strategy);
      // Both at 50%, targets 60/40, deviation 10% > threshold 5%
      expect(result).toBe(true);
    });
  });

  describe('execute', () => {
    it('should create BUY and SELL transactions', async () => {
      positionRepository.find.mockResolvedValue([
        { fund_code: '110011', shares: 100 },
        { fund_code: '000001', shares: 100 },
      ]);
      positionRepository.findOne
        .mockResolvedValueOnce({ shares: 100 }) // 110011
        .mockResolvedValueOnce({ shares: 100 }); // 000001
      fundDataService.getFundNav.mockResolvedValue({ nav: 1.0 } as any);
      brokerService.buyFund.mockResolvedValue({ id: 'order-buy', fundCode: '110011', amount: 100, status: 'PENDING' });
      brokerService.sellFund.mockResolvedValue({ id: 'order-sell', fundCode: '000001', amount: 100, status: 'PENDING' });

      const result = await strategy.execute(mockStrategy as Strategy);

      expect(result.length).toBeGreaterThan(0);
      expect(notifyService.send).toHaveBeenCalledWith(
        expect.objectContaining({ title: '再平衡执行完成' }),
      );
    });

    it('should throw and notify on error', async () => {
      (isTradeTime as jest.Mock).mockReturnValueOnce(false);

      await expect(strategy.execute(mockStrategy as Strategy))
        .rejects.toThrow('非交易时间');
    });
  });
});
