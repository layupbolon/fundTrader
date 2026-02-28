import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TakeProfitStopLossStrategy } from '../take-profit-stop-loss.strategy';
import { Position, Transaction, TransactionType, TransactionStatus } from '../../../models';
import { TiantianBrokerService } from '../../../services/broker/tiantian.service';
import { NotifyService } from '../../../services/notify/notify.service';

describe('TakeProfitStopLossStrategy', () => {
  let service: TakeProfitStopLossStrategy;
  let positionRepository: jest.Mocked<Repository<Position>>;
  let transactionRepository: jest.Mocked<Repository<Transaction>>;
  let brokerService: jest.Mocked<TiantianBrokerService>;
  let notifyService: jest.Mocked<NotifyService>;

  beforeEach(async () => {
    const mockPositionRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const mockTransactionRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockBrokerService = {
      sellFund: jest.fn(),
    };

    const mockNotifyService = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TakeProfitStopLossStrategy,
        {
          provide: getRepositoryToken(Position),
          useValue: mockPositionRepository,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: TiantianBrokerService,
          useValue: mockBrokerService,
        },
        {
          provide: NotifyService,
          useValue: mockNotifyService,
        },
      ],
    }).compile();

    service = module.get<TakeProfitStopLossStrategy>(TakeProfitStopLossStrategy);
    positionRepository = module.get(getRepositoryToken(Position));
    transactionRepository = module.get(getRepositoryToken(Transaction));
    brokerService = module.get(TiantianBrokerService);
    notifyService = module.get(NotifyService);
  });

  describe('checkTakeProfit', () => {
    const createPosition = (profitRate: number, maxProfitRate?: number): Position => ({
      id: 'pos1',
      user_id: 'user1',
      fund_code: '000001',
      shares: 1000,
      avg_price: 1.5,
      cost: 1500,
      current_value: 1500 * (1 + profitRate),
      profit: 1500 * profitRate,
      profit_rate: profitRate,
      max_profit_rate: maxProfitRate ?? profitRate,
      updated_at: new Date(),
      user: null,
      fund: null,
    });

    it('should return true when profit rate reaches target', async () => {
      const position = createPosition(0.15); // 15% profit
      const config = { target_rate: 0.1, sell_ratio: 1.0 }; // 10% target

      const result = await service.checkTakeProfit(position, config);
      expect(result).toBe(true);
    });

    it('should return false when profit rate below target', async () => {
      const position = createPosition(0.05); // 5% profit
      const config = { target_rate: 0.1, sell_ratio: 1.0 }; // 10% target

      const result = await service.checkTakeProfit(position, config);
      expect(result).toBe(false);
    });

    it('should return true for trailing stop when drawdown exceeds threshold', async () => {
      const position = createPosition(0.08); // 8% profit
      const config = { target_rate: 0.2, sell_ratio: 1.0, trailing_stop: 0.05 }; // 5% trailing

      // Mock max profit rate at 15%
      positionRepository.findOne.mockResolvedValue(createPosition(0.15));

      const result = await service.checkTakeProfit(position, config);
      expect(result).toBe(true); // 15% - 8% = 7% > 5% threshold
    });

    it('should return false for trailing stop when drawdown within threshold', async () => {
      const position = createPosition(0.12); // 12% profit
      const config = { target_rate: 0.2, sell_ratio: 1.0, trailing_stop: 0.05 }; // 5% trailing

      // Mock max profit rate at 15%
      positionRepository.findOne.mockResolvedValue(createPosition(0.15));

      const result = await service.checkTakeProfit(position, config);
      expect(result).toBe(false); // 15% - 12% = 3% < 5% threshold
    });

    it('should handle missing trailing stop config', async () => {
      const position = createPosition(0.05);
      const config = { target_rate: 0.1, sell_ratio: 1.0 }; // No trailing_stop

      const result = await service.checkTakeProfit(position, config);
      expect(result).toBe(false);
      expect(positionRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('checkStopLoss', () => {
    const createPosition = (profitRate: number): Position => ({
      id: 'pos1',
      user_id: 'user1',
      fund_code: '000001',
      shares: 1000,
      avg_price: 1.5,
      cost: 1500,
      current_value: 1500 * (1 + profitRate),
      profit: 1500 * profitRate,
      profit_rate: profitRate,
      max_profit_rate: Math.max(profitRate, 0),
      updated_at: new Date(),
      user: null,
      fund: null,
    });

    it('should return true when loss exceeds max drawdown', async () => {
      const position = createPosition(-0.15); // -15% loss
      const config = { max_drawdown: -0.1, sell_ratio: 1.0 }; // -10% max

      const result = await service.checkStopLoss(position, config);
      expect(result).toBe(true);
    });

    it('should return false when loss within max drawdown', async () => {
      const position = createPosition(-0.05); // -5% loss
      const config = { max_drawdown: -0.1, sell_ratio: 1.0 }; // -10% max

      const result = await service.checkStopLoss(position, config);
      expect(result).toBe(false);
    });

    it('should return false for positive profit', async () => {
      const position = createPosition(0.1); // 10% profit
      const config = { max_drawdown: -0.1, sell_ratio: 1.0 };

      const result = await service.checkStopLoss(position, config);
      expect(result).toBe(false);
    });
  });

  describe('executeSell', () => {
    const createPosition = (): Position => ({
      id: 'pos1',
      user_id: 'user1',
      fund_code: '000001',
      shares: 1000,
      avg_price: 1.5,
      cost: 1500,
      current_value: 1650,
      profit: 150,
      profit_rate: 0.1,
      max_profit_rate: 0.1,
      updated_at: new Date(),
      user: null,
      fund: null,
    });

    it('should execute sell order successfully', async () => {
      const position = createPosition();
      const mockOrder = {
        id: 'order123',
        fundCode: '000001',
        amount: 750,
        status: 'pending',
      };
      const mockTransaction = {
        id: 'tx123',
        user_id: 'user1',
        fund_code: '000001',
        type: TransactionType.SELL,
        shares: 500,
        amount: 750,
        status: TransactionStatus.PENDING,
        order_id: 'order123',
        strategy_id: 'strategy1',
      };

      brokerService.sellFund.mockResolvedValue(mockOrder);
      transactionRepository.create.mockReturnValue(mockTransaction as Transaction);
      transactionRepository.save.mockResolvedValue(mockTransaction as Transaction);

      const result = await service.executeSell(position, 0.5, '止盈', 'strategy1');

      expect(brokerService.sellFund).toHaveBeenCalledWith('000001', 500);
      expect(transactionRepository.create).toHaveBeenCalledWith({
        user_id: 'user1',
        fund_code: '000001',
        type: TransactionType.SELL,
        shares: 500,
        amount: 750,
        status: TransactionStatus.PENDING,
        order_id: 'order123',
        strategy_id: 'strategy1',
      });
      expect(transactionRepository.save).toHaveBeenCalled();
      expect(notifyService.send).toHaveBeenCalledWith({
        title: '止盈触发',
        content: expect.stringContaining('000001'),
        level: 'warning',
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should calculate shares correctly for partial sell', async () => {
      const position = createPosition();
      const mockOrder = {
        id: 'order123',
        fundCode: '000001',
        amount: 300,
        status: 'pending',
      };

      brokerService.sellFund.mockResolvedValue(mockOrder);
      transactionRepository.create.mockReturnValue({} as Transaction);
      transactionRepository.save.mockResolvedValue({} as Transaction);

      await service.executeSell(position, 0.2, '止损', 'strategy1');

      expect(brokerService.sellFund).toHaveBeenCalledWith('000001', 200); // 1000 * 0.2
    });

    it('should send error notification on failure', async () => {
      const position = createPosition();
      const error = new Error('Network error');

      brokerService.sellFund.mockRejectedValue(error);

      await expect(service.executeSell(position, 0.5, '止盈', 'strategy1')).rejects.toThrow(
        'Network error',
      );

      expect(notifyService.send).toHaveBeenCalledWith({
        title: '止盈执行失败',
        content: expect.stringContaining('Network error'),
        level: 'error',
      });
    });

    it('should not create transaction if sell fails', async () => {
      const position = createPosition();
      brokerService.sellFund.mockRejectedValue(new Error('Sell failed'));

      await expect(service.executeSell(position, 0.5, '止盈', 'strategy1')).rejects.toThrow();

      expect(transactionRepository.create).not.toHaveBeenCalled();
      expect(transactionRepository.save).not.toHaveBeenCalled();
    });
  });
});
