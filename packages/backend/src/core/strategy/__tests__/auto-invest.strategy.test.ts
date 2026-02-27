import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutoInvestStrategy } from '../auto-invest.strategy';
import {
  Strategy,
  Transaction,
  InvestFrequency,
  StrategyType,
  TransactionType,
  TransactionStatus,
} from '../../../models';
import { TiantianBrokerService } from '../../../services/broker/tiantian.service';
import { NotifyService } from '../../../services/notify/notify.service';

describe('AutoInvestStrategy', () => {
  let service: AutoInvestStrategy;
  let strategyRepository: jest.Mocked<Repository<Strategy>>;
  let transactionRepository: jest.Mocked<Repository<Transaction>>;
  let brokerService: jest.Mocked<TiantianBrokerService>;
  let notifyService: jest.Mocked<NotifyService>;

  beforeEach(async () => {
    const mockStrategyRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };

    const mockTransactionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const mockBrokerService = {
      buyFund: jest.fn(),
      sellFund: jest.fn(),
      login: jest.fn(),
    };

    const mockNotifyService = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoInvestStrategy,
        {
          provide: getRepositoryToken(Strategy),
          useValue: mockStrategyRepository,
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

    service = module.get<AutoInvestStrategy>(AutoInvestStrategy);
    strategyRepository = module.get(getRepositoryToken(Strategy));
    transactionRepository = module.get(getRepositoryToken(Transaction));
    brokerService = module.get(TiantianBrokerService);
    notifyService = module.get(NotifyService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('shouldExecute', () => {
    const createStrategy = (overrides = {}): Strategy => ({
      id: '1',
      user_id: 'user1',
      fund_code: '000001',
      name: 'Test Strategy',
      type: StrategyType.AUTO_INVEST,
      enabled: true,
      config: {
        amount: 1000,
        frequency: InvestFrequency.DAILY,
        start_date: new Date('2026-01-01'),
      },
      created_at: new Date(),
      last_executed_at: null,
      user: null,
      fund: null,
      ...overrides,
    });

    it('should return false if strategy is disabled', async () => {
      const strategy = createStrategy({ enabled: false });
      const result = await service.shouldExecute(strategy);
      expect(result).toBe(false);
    });

    it('should return false if before start date', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-12-31T10:00:00'));

      const strategy = createStrategy({
        config: {
          amount: 1000,
          frequency: InvestFrequency.DAILY,
          start_date: new Date('2026-01-01'),
        },
      });

      const result = await service.shouldExecute(strategy);
      expect(result).toBe(false);
    });

    it('should return false if after end date', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-12-31T10:00:00'));

      const strategy = createStrategy({
        config: {
          amount: 1000,
          frequency: InvestFrequency.DAILY,
          start_date: new Date('2026-01-01'),
          end_date: new Date('2026-06-30'),
        },
      });

      const result = await service.shouldExecute(strategy);
      expect(result).toBe(false);
    });

    it('should return false on weekend', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-02-28T10:00:00')); // Saturday

      const strategy = createStrategy();
      const result = await service.shouldExecute(strategy);
      expect(result).toBe(false);
    });

    it('should return false after 15:00', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-02-25T15:30:00')); // Wednesday 15:30

      const strategy = createStrategy();
      const result = await service.shouldExecute(strategy);
      expect(result).toBe(false);
    });

    it('should return true for daily strategy on workday', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-02-25T14:00:00')); // Wednesday 14:00

      const strategy = createStrategy({
        config: {
          amount: 1000,
          frequency: InvestFrequency.DAILY,
          start_date: new Date('2026-01-01'),
        },
      });

      const result = await service.shouldExecute(strategy);
      expect(result).toBe(true);
    });

    it('should return true for weekly strategy on correct day', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-02-23T14:00:00')); // Monday 14:00

      const strategy = createStrategy({
        config: {
          amount: 1000,
          frequency: InvestFrequency.WEEKLY,
          day_of_week: 1, // Monday
          start_date: new Date('2026-01-01'),
        },
      });

      const result = await service.shouldExecute(strategy);
      expect(result).toBe(true);
    });

    it('should return false for weekly strategy on wrong day', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-02-25T14:00:00')); // Wednesday 14:00

      const strategy = createStrategy({
        config: {
          amount: 1000,
          frequency: InvestFrequency.WEEKLY,
          day_of_week: 1, // Monday
          start_date: new Date('2026-01-01'),
        },
      });

      const result = await service.shouldExecute(strategy);
      expect(result).toBe(false);
    });

    it('should return true for monthly strategy on correct day', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-02-16T14:00:00')); // 16th day, Monday

      const strategy = createStrategy({
        config: {
          amount: 1000,
          frequency: InvestFrequency.MONTHLY,
          day_of_month: 16,
          start_date: new Date('2026-01-01'),
        },
      });

      const result = await service.shouldExecute(strategy);
      expect(result).toBe(true);
    });
  });

  describe('execute', () => {
    const createStrategy = (): Strategy => ({
      id: '1',
      user_id: 'user1',
      fund_code: '000001',
      name: 'Test Strategy',
      type: StrategyType.AUTO_INVEST,
      enabled: true,
      config: {
        amount: 1000,
        frequency: InvestFrequency.DAILY,
        start_date: new Date('2026-01-01'),
      },
      created_at: new Date(),
      last_executed_at: null,
      user: null,
      fund: null,
    });

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-02-25T14:00:00')); // Wednesday 14:00
    });

    it('should throw error if not trade time', async () => {
      jest.setSystemTime(new Date('2026-02-28T10:00:00')); // Saturday

      const strategy = createStrategy();
      await expect(service.execute(strategy)).rejects.toThrow('非交易时间');
    });

    it('should skip execution if duplicate transaction exists today', async () => {
      const strategy = createStrategy();
      const existingTransaction = {
        id: 'existing-tx',
        user_id: 'user1',
        fund_code: '000001',
        type: TransactionType.BUY,
        amount: 1000,
        status: TransactionStatus.PENDING,
        order_id: 'existing-order',
        strategy_id: '1',
        submitted_at: new Date('2026-02-25T10:00:00'),
      } as Transaction;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(existingTransaction),
      };
      transactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.execute(strategy);

      expect(result).toEqual(existingTransaction);
      expect(brokerService.buyFund).not.toHaveBeenCalled();
      expect(transactionRepository.create).not.toHaveBeenCalled();
      expect(transactionRepository.save).not.toHaveBeenCalled();
    });

    it('should update last_executed_at after successful execution', async () => {
      const strategy = createStrategy();
      const mockOrder = {
        id: 'order123',
        fundCode: '000001',
        amount: 1000,
        status: 'pending',
      };
      const mockTransaction = {
        id: 'tx123',
        user_id: 'user1',
        fund_code: '000001',
        type: TransactionType.BUY,
        amount: 1000,
        status: TransactionStatus.PENDING,
        order_id: 'order123',
        strategy_id: '1',
      };

      brokerService.buyFund.mockResolvedValue(mockOrder);
      transactionRepository.create.mockReturnValue(mockTransaction as Transaction);
      transactionRepository.save.mockResolvedValue(mockTransaction as Transaction);

      await service.execute(strategy);

      expect(strategyRepository.update).toHaveBeenCalledWith('1', {
        last_executed_at: expect.any(Date),
      });
    });

    it('should execute normally if no duplicate exists', async () => {
      const strategy = createStrategy();
      const mockOrder = {
        id: 'order456',
        fundCode: '000001',
        amount: 1000,
        status: 'pending',
      };
      const mockTransaction = {
        id: 'tx456',
        user_id: 'user1',
        fund_code: '000001',
        type: TransactionType.BUY,
        amount: 1000,
        status: TransactionStatus.PENDING,
        order_id: 'order456',
        strategy_id: '1',
      };

      // createQueryBuilder default mock already returns null for getOne
      brokerService.buyFund.mockResolvedValue(mockOrder);
      transactionRepository.create.mockReturnValue(mockTransaction as Transaction);
      transactionRepository.save.mockResolvedValue(mockTransaction as Transaction);

      const result = await service.execute(strategy);

      expect(transactionRepository.createQueryBuilder).toHaveBeenCalledWith('t');
      expect(brokerService.buyFund).toHaveBeenCalledWith('000001', 1000);
      expect(transactionRepository.create).toHaveBeenCalled();
      expect(transactionRepository.save).toHaveBeenCalled();
      expect(strategyRepository.update).toHaveBeenCalledWith('1', {
        last_executed_at: expect.any(Date),
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should execute buy order successfully', async () => {
      const strategy = createStrategy();
      const mockOrder = {
        id: 'order123',
        fundCode: '000001',
        amount: 1000,
        status: 'pending',
      };
      const mockTransaction = {
        id: 'tx123',
        user_id: 'user1',
        fund_code: '000001',
        type: TransactionType.BUY,
        amount: 1000,
        status: TransactionStatus.PENDING,
        order_id: 'order123',
        strategy_id: '1',
      };

      brokerService.buyFund.mockResolvedValue(mockOrder);
      transactionRepository.create.mockReturnValue(mockTransaction as Transaction);
      transactionRepository.save.mockResolvedValue(mockTransaction as Transaction);

      const result = await service.execute(strategy);

      expect(brokerService.buyFund).toHaveBeenCalledWith('000001', 1000);
      expect(transactionRepository.create).toHaveBeenCalledWith({
        user_id: 'user1',
        fund_code: '000001',
        type: TransactionType.BUY,
        amount: 1000,
        status: TransactionStatus.PENDING,
        order_id: 'order123',
        strategy_id: '1',
      });
      expect(transactionRepository.save).toHaveBeenCalled();
      expect(notifyService.send).toHaveBeenCalledWith({
        title: '定投执行成功',
        content: expect.stringContaining('000001'),
        level: 'info',
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should send error notification on failure', async () => {
      const strategy = createStrategy();
      const error = new Error('Network error');

      brokerService.buyFund.mockRejectedValue(error);

      await expect(service.execute(strategy)).rejects.toThrow('Network error');

      expect(notifyService.send).toHaveBeenCalledWith({
        title: '定投执行失败',
        content: expect.stringContaining('Network error'),
        level: 'error',
      });
    });

    it('should not create transaction if buy fails', async () => {
      const strategy = createStrategy();
      brokerService.buyFund.mockRejectedValue(new Error('Buy failed'));

      await expect(service.execute(strategy)).rejects.toThrow();

      expect(transactionRepository.create).not.toHaveBeenCalled();
      expect(transactionRepository.save).not.toHaveBeenCalled();
    });
  });
});
