import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Transaction,
  TransactionConfirmationStatus,
  TransactionType,
  RiskLimitType,
} from '../../../models';
import { TradingConfirmationService } from '../trading-confirmation.service';
import { NotifyService } from '../../../services/notify/notify.service';
import { TelegramService } from '../../../services/notify/telegram.service';
import { FeishuService } from '../../../services/notify/feishu.service';
import { RiskControlService } from '../../risk/risk-control.service';

describe('TradingConfirmationService', () => {
  let service: TradingConfirmationService;
  let transactionRepository: Repository<Transaction>;
  let riskControlService: RiskControlService;
  let notifyService: NotifyService;

  const mockTransaction = {
    id: 'test-txn-id',
    user_id: 'user-123',
    fund_code: '000001',
    type: TransactionType.BUY,
    amount: 15000,
    requires_confirmation: true,
    confirmation_status: TransactionConfirmationStatus.PENDING_CONFIRMATION,
    confirmation_deadline: new Date(Date.now() + 30 * 60 * 1000),
    strategy_id: 'strategy-123',
    user_confirmed_at: undefined,
    cancelled_at: undefined,
  } as Transaction;

  const mockRiskLimit = {
    id: 'limit-123',
    user_id: 'user-123',
    type: RiskLimitType.SINGLE_TRADE_CONFIRM_THRESHOLD,
    limit_value: 10000,
    enabled: true,
  } as any;

  const transactionRepositoryMock = {
    create: jest.fn().mockImplementation((data) => data),
    save: jest.fn().mockImplementation((data) => Promise.resolve({ ...mockTransaction, ...data })),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ ...mockTransaction }),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const riskControlServiceMock = {
    getRiskLimits: jest.fn().mockResolvedValue([mockRiskLimit]),
  };

  const notifyServiceMock = {
    send: jest.fn().mockResolvedValue(undefined),
  };

  const telegramServiceMock = {
    sendConfirmationMessage: jest.fn().mockResolvedValue(undefined),
    onConfirmationCallback: jest.fn(),
  };

  const feishuServiceMock = {
    sendConfirmationMessage: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    // 重置所有 mock 为返回基础的 mockTransaction 的拷贝
    transactionRepositoryMock.findOne = jest.fn().mockResolvedValue({ ...mockTransaction });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradingConfirmationService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: transactionRepositoryMock,
        },
        {
          provide: RiskControlService,
          useValue: riskControlServiceMock,
        },
        {
          provide: NotifyService,
          useValue: notifyServiceMock,
        },
        {
          provide: TelegramService,
          useValue: telegramServiceMock,
        },
        {
          provide: FeishuService,
          useValue: feishuServiceMock,
        },
      ],
    }).compile();

    service = module.get<TradingConfirmationService>(TradingConfirmationService);
    transactionRepository = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    riskControlService = module.get<RiskControlService>(RiskControlService);
    notifyService = module.get<NotifyService>(NotifyService);

    // 清除所有 mock 调用记录
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('needsConfirmation', () => {
    it('should return true when amount exceeds threshold', async () => {
      const result = await service.needsConfirmation('user-123', 15000);
      expect(result).toBe(true);
      expect(riskControlService.getRiskLimits).toHaveBeenCalledWith('user-123', [
        RiskLimitType.SINGLE_TRADE_CONFIRM_THRESHOLD,
      ]);
    });

    it('should return false when amount is below threshold', async () => {
      const result = await service.needsConfirmation('user-123', 5000);
      expect(result).toBe(false);
    });

    it('should return false when no threshold is configured', async () => {
      riskControlService.getRiskLimits = jest.fn().mockResolvedValue([]);
      const result = await service.needsConfirmation('user-123', 15000);
      expect(result).toBe(false);
    });
  });

  describe('createPendingTransaction', () => {
    it('should create a pending transaction with correct fields', async () => {
      const params = {
        userId: 'user-123',
        fundCode: '000001',
        amount: 15000,
        type: TransactionType.BUY as const,
        strategyId: 'strategy-123',
        confirmationTimeoutMinutes: 30,
      };

      const result = await service.createPendingTransaction(params);

      expect(transactionRepository.create).toHaveBeenCalledWith({
        user_id: 'user-123',
        fund_code: '000001',
        type: TransactionType.BUY,
        amount: 15000,
        requires_confirmation: true,
        confirmation_status: TransactionConfirmationStatus.PENDING_CONFIRMATION,
        confirmation_deadline: expect.any(Date),
        strategy_id: 'strategy-123',
        status: 'PENDING',
      });

      expect(transactionRepository.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expect.objectContaining({
        user_id: 'user-123',
        fund_code: '000001',
        type: TransactionType.BUY,
        amount: 15000,
        requires_confirmation: true,
        confirmation_status: TransactionConfirmationStatus.PENDING_CONFIRMATION,
      }));
    });
  });

  describe('sendConfirmationRequest', () => {
    it('should send confirmation request to all channels', async () => {
      await service.sendConfirmationRequest(mockTransaction);

      expect(telegramServiceMock.sendConfirmationMessage).toHaveBeenCalledWith({
        transactionId: mockTransaction.id,
        fundCode: mockTransaction.fund_code,
        amount: mockTransaction.amount,
        type: mockTransaction.type,
        deadline: mockTransaction.confirmation_deadline,
      });

      expect(feishuServiceMock.sendConfirmationMessage).toHaveBeenCalledWith({
        transactionId: mockTransaction.id,
        fundCode: mockTransaction.fund_code,
        amount: mockTransaction.amount,
        type: mockTransaction.type,
        deadline: mockTransaction.confirmation_deadline,
      });
    });
  });

  describe('handleConfirmation', () => {
    beforeEach(() => {
      // 重置 findOne 返回基础的 mockTransaction 的拷贝
      transactionRepository.findOne = jest.fn().mockResolvedValue({ ...mockTransaction });
    });

    it('should confirm a pending transaction successfully', async () => {
      const result = await service.handleConfirmation('test-txn-id', { source: 'telegram' });

      expect(transactionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-txn-id' },
        relations: ['strategy'],
      });

      expect(transactionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmation_status: TransactionConfirmationStatus.CONFIRMED,
          user_confirmed_at: expect.any(Date),
          confirmation_callback_data: { source: 'telegram' },
        }),
      );

      expect(notifyService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '交易已确认',
        }),
      );

      expect(result.confirmation_status).toBe(TransactionConfirmationStatus.CONFIRMED);
    });

    it('should throw error when transaction not found', async () => {
      transactionRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(service.handleConfirmation('non-existent-id')).rejects.toThrow(
        '交易 non-existent-id 不存在',
      );
    });

    it('should throw error when transaction is not in PENDING_CONFIRMATION status', async () => {
      const confirmedTransaction = {
        ...mockTransaction,
        confirmation_status: TransactionConfirmationStatus.CONFIRMED,
      };
      transactionRepository.findOne = jest.fn().mockResolvedValue(confirmedTransaction);

      await expect(service.handleConfirmation('test-txn-id')).rejects.toThrow(
        '交易 test-txn-id 状态不正确：CONFIRMED',
      );
    });

    it('should throw error when transaction is timeout', async () => {
      const expiredTransaction = {
        ...mockTransaction,
        confirmation_deadline: new Date(Date.now() - 60 * 1000), // 1 分钟前过期
      };
      transactionRepository.findOne = jest.fn().mockResolvedValue(expiredTransaction);

      await expect(service.handleConfirmation('test-txn-id')).rejects.toThrow('交易 test-txn-id 已超时');
    });

    afterEach(() => {
      // 重置 findOne 返回基础的 mockTransaction 的拷贝
      transactionRepository.findOne = jest.fn().mockResolvedValue({ ...mockTransaction });
    });
  });

  describe('handleCancellation', () => {
    beforeEach(() => {
      // 重置 findOne 返回基础的 mockTransaction 的拷贝
      transactionRepository.findOne = jest.fn().mockResolvedValue({ ...mockTransaction });
    });

    it('should cancel a pending transaction successfully', async () => {
      const result = await service.handleCancellation('test-txn-id', { source: 'telegram' });

      expect(transactionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmation_status: TransactionConfirmationStatus.CANCELLED,
          cancelled_at: expect.any(Date),
          confirmation_callback_data: { source: 'telegram' },
        }),
      );

      expect(notifyService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '交易已取消',
        }),
      );

      expect(result.confirmation_status).toBe(TransactionConfirmationStatus.CANCELLED);
    });

    it('should throw error when transaction not found', async () => {
      transactionRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(service.handleCancellation('non-existent-id')).rejects.toThrow(
        '交易 non-existent-id 不存在',
      );
    });
  });

  describe('cancelTimeoutTransactions', () => {
    it('should cancel all timeout transactions', async () => {
      const expiredTransaction = {
        ...mockTransaction,
        id: 'expired-txn',
        confirmation_deadline: new Date(Date.now() - 60 * 1000),
      };

      transactionRepository.find = jest.fn().mockResolvedValue([expiredTransaction]);

      const result = await service.cancelTimeoutTransactions();

      expect(result).toBe(1);
      expect(transactionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmation_status: TransactionConfirmationStatus.TIMEOUT_CANCELLED,
          cancelled_at: expect.any(Date),
        }),
      );

      expect(notifyService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '交易超时取消',
        }),
      );
    });

    it('should return 0 when no timeout transactions found', async () => {
      transactionRepository.find = jest.fn().mockResolvedValue([]);

      const result = await service.cancelTimeoutTransactions();

      expect(result).toBe(0);
    });
  });

  describe('getPendingConfirmations', () => {
    it('should get all pending confirmations for a user', async () => {
      await service.getPendingConfirmations('user-123');

      expect(transactionRepository.find).toHaveBeenCalledWith({
        where: {
          confirmation_status: TransactionConfirmationStatus.PENDING_CONFIRMATION,
          user_id: 'user-123',
        },
        relations: ['strategy'],
        order: { confirmation_deadline: 'ASC' },
      });
    });

    it('should get all pending confirmations for all users when userId is not provided', async () => {
      await service.getPendingConfirmations();

      expect(transactionRepository.find).toHaveBeenCalledWith({
        where: {
          confirmation_status: TransactionConfirmationStatus.PENDING_CONFIRMATION,
        },
        relations: ['strategy'],
        order: { confirmation_deadline: 'ASC' },
      });
    });
  });

  describe('getConfirmationStatus', () => {
    it('should return confirmation status for a transaction', async () => {
      const result = await service.getConfirmationStatus('test-txn-id');

      expect(result).toEqual({
        requiresConfirmation: mockTransaction.requires_confirmation,
        confirmationStatus: mockTransaction.confirmation_status,
        deadline: mockTransaction.confirmation_deadline,
        confirmedAt: mockTransaction.user_confirmed_at,
        cancelledAt: mockTransaction.cancelled_at,
      });
    });

    it('should return null when transaction not found', async () => {
      transactionRepository.findOne = jest.fn().mockResolvedValue(null);

      const result = await service.getConfirmationStatus('non-existent-id');

      expect(result).toBe(null);
    });
  });
});
