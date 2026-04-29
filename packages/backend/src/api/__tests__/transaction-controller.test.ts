import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Transaction, TransactionType, TransactionStatus } from '../../models';
import { TransactionController } from '../controllers';
import { PaginationDto } from '../pagination.dto';
import { Fund } from '../../models/fund.entity';
import { Position } from '../../models/position.entity';
import { RiskControlService } from '../../core/risk/risk-control.service';
import { TradingConfirmationService } from '../../core/trading/trading-confirmation.service';
import { TiantianBrokerService } from '../../services/broker/tiantian.service';
import { OperationLogService } from '../../core/logger/operation-log.service';

describe('TransactionController', () => {
  let controller: TransactionController;
  let transactionRepository: any;
  let fundRepository: any;
  let positionRepository: any;
  let riskControlService: any;
  let tradingConfirmationService: any;
  let brokerService: any;
  let operationLogService: any;

  const mockUser = { id: 'user-uuid-1', username: 'testuser' };
  const mockTransaction = {
    id: 'tx-uuid-1',
    user_id: 'user-uuid-1',
    fund_code: '110011',
    type: TransactionType.BUY,
    amount: 1000,
    status: TransactionStatus.PENDING,
    submitted_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    transactionRepository = {
      findOne: vi.fn(),
      findAndCount: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
    };
    fundRepository = {
      findOne: vi.fn(),
    };
    positionRepository = {
      findOne: vi.fn(),
    };
    riskControlService = {
      checkFundBlacklist: vi.fn().mockResolvedValue({ passed: true }),
      checkTradeLimit: vi.fn().mockResolvedValue({ passed: true }),
      checkPositionLimit: vi.fn().mockResolvedValue({ passed: true }),
    };
    tradingConfirmationService = {
      needsConfirmation: vi.fn().mockResolvedValue(false),
      createPendingTransaction: vi.fn(),
      sendConfirmationRequest: vi.fn(),
    };
    brokerService = {
      buyFund: vi.fn().mockResolvedValue({ id: 'order-buy-1' }),
      sellFund: vi.fn().mockResolvedValue({ id: 'order-sell-1' }),
    };
    operationLogService = {
      logUserAction: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        {
          provide: getRepositoryToken(Transaction),
          useValue: transactionRepository,
        },
        {
          provide: getRepositoryToken(Fund),
          useValue: fundRepository,
        },
        {
          provide: getRepositoryToken(Position),
          useValue: positionRepository,
        },
        {
          provide: RiskControlService,
          useValue: riskControlService,
        },
        {
          provide: TradingConfirmationService,
          useValue: tradingConfirmationService,
        },
        {
          provide: TiantianBrokerService,
          useValue: brokerService,
        },
        {
          provide: OperationLogService,
          useValue: operationLogService,
        },
      ],
    }).compile();

    controller = module.get<TransactionController>(TransactionController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create buy transaction successfully', async () => {
      fundRepository.findOne.mockResolvedValue({ code: '110011' });
      transactionRepository.create.mockReturnValue({
        id: 'tx-new',
        user_id: 'user-uuid-1',
        fund_code: '110011',
        type: TransactionType.BUY,
        amount: 1000,
        status: TransactionStatus.PENDING,
        order_id: 'order-buy-1',
      });
      transactionRepository.save.mockResolvedValue({
        id: 'tx-new',
        user_id: 'user-uuid-1',
        fund_code: '110011',
        type: TransactionType.BUY,
        amount: 1000,
        status: TransactionStatus.PENDING,
        order_id: 'order-buy-1',
      });

      const result = await controller.create(
        { fund_code: '110011', type: TransactionType.BUY, amount: 1000 },
        mockUser,
      );

      expect(result).toEqual({
        id: 'tx-new',
        status: TransactionStatus.PENDING,
        requires_confirmation: false,
      });
      expect(brokerService.buyFund).toHaveBeenCalledWith('110011', 1000);
    });

    it('should create pending transaction when confirmation is required', async () => {
      fundRepository.findOne.mockResolvedValue({ code: '110011' });
      tradingConfirmationService.needsConfirmation.mockResolvedValue(true);
      tradingConfirmationService.createPendingTransaction.mockResolvedValue({
        id: 'tx-pending',
        status: TransactionStatus.PENDING,
      });

      const result = await controller.create(
        { fund_code: '110011', type: TransactionType.BUY, amount: 10000 },
        mockUser,
      );

      expect(result).toEqual({
        id: 'tx-pending',
        status: TransactionStatus.PENDING,
        requires_confirmation: true,
      });
      expect(tradingConfirmationService.sendConfirmationRequest).toHaveBeenCalled();
    });

    it('should reject when trade limit check fails', async () => {
      fundRepository.findOne.mockResolvedValue({ code: '110011' });
      riskControlService.checkTradeLimit.mockResolvedValue({
        passed: false,
        message: 'over limit',
      });

      await expect(
        controller.create(
          { fund_code: '110011', type: TransactionType.BUY, amount: 1000 },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated transactions for current user', async () => {
      transactionRepository.findAndCount.mockResolvedValue([[mockTransaction], 1]);

      const pagination: PaginationDto = { page: 1, limit: 20 };
      const result = await controller.findAll(pagination, mockUser);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(transactionRepository.findAndCount).toHaveBeenCalledWith({
        where: { user_id: 'user-uuid-1' },
        relations: ['fund', 'strategy'],
        skip: 0,
        take: 20,
        order: { submitted_at: 'DESC' },
      });
    });

    it('should filter transactions by fund_code when provided', async () => {
      transactionRepository.findAndCount.mockResolvedValue([[mockTransaction], 1]);

      const pagination: PaginationDto = { page: 1, limit: 20 };
      await controller.findAll(pagination, mockUser, '110011');

      expect(transactionRepository.findAndCount).toHaveBeenCalledWith({
        where: { user_id: 'user-uuid-1', fund_code: '110011' },
        relations: ['fund', 'strategy'],
        skip: 0,
        take: 20,
        order: { submitted_at: 'DESC' },
      });
    });

    it('should handle pagination parameters correctly', async () => {
      transactionRepository.findAndCount.mockResolvedValue([[mockTransaction], 50]);

      const pagination: PaginationDto = { page: 2, limit: 10 };
      await controller.findAll(pagination, mockUser);

      expect(transactionRepository.findAndCount).toHaveBeenCalledWith({
        where: { user_id: 'user-uuid-1' },
        relations: ['fund', 'strategy'],
        skip: 10,
        take: 10,
        order: { submitted_at: 'DESC' },
      });
    });

    it('should return empty array when no transactions exist', async () => {
      transactionRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await controller.findAll({ page: 1, limit: 20 }, mockUser);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return a single transaction by id within current user scope', async () => {
      transactionRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await controller.findOne('tx-uuid-1', mockUser);

      expect(result).toEqual(mockTransaction);
      expect(transactionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'tx-uuid-1', user_id: 'user-uuid-1' },
        relations: ['fund', 'strategy'],
      });
    });

    it('should return null when transaction not found', async () => {
      transactionRepository.findOne.mockResolvedValue(null);

      const result = await controller.findOne('nonexistent-tx', mockUser);

      expect(result).toBeNull();
    });
  });

  describe('refreshStatus', () => {
    it('should refresh transaction status from broker', async () => {
      transactionRepository.findOne
        .mockResolvedValueOnce({
          ...mockTransaction,
          order_id: 'order-1',
          user_id: mockUser.id,
        })
        .mockResolvedValueOnce({
          ...mockTransaction,
          id: 'tx-uuid-1',
          status: TransactionStatus.CONFIRMED,
        });
      brokerService.getOrderStatus = vi.fn().mockResolvedValue({
        id: 'order-1',
        status: 'CONFIRMED',
        shares: 100,
        price: 1.23,
      });

      const result = await controller.refreshStatus('tx-uuid-1', mockUser);

      expect(transactionRepository.update).toHaveBeenCalledWith(
        'tx-uuid-1',
        expect.objectContaining({ status: TransactionStatus.CONFIRMED }),
      );
      expect(result.status).toBe(TransactionStatus.CONFIRMED);
    });
  });

  describe('cancel', () => {
    it('should cancel pending transaction', async () => {
      transactionRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        id: 'tx-uuid-1',
        user_id: mockUser.id,
        status: TransactionStatus.PENDING,
        order_id: 'order-1',
      });
      brokerService.cancelOrder = vi.fn().mockResolvedValue({ id: 'order-1', status: 'CANCELLED' });

      const result = await controller.cancel('tx-uuid-1', mockUser);

      expect(transactionRepository.update).toHaveBeenCalledWith(
        'tx-uuid-1',
        expect.objectContaining({ status: TransactionStatus.CANCELLED }),
      );
      expect(result.status).toBe(TransactionStatus.CANCELLED);
    });
  });

  describe('batch operations', () => {
    it('should batch refresh status', async () => {
      transactionRepository.findOne
        .mockResolvedValueOnce({
          ...mockTransaction,
          id: 'tx-1',
          user_id: mockUser.id,
          order_id: 'order-1',
        })
        .mockResolvedValueOnce({
          ...mockTransaction,
          id: 'tx-1',
          status: TransactionStatus.PENDING,
        });
      brokerService.getOrderStatus = vi
        .fn()
        .mockResolvedValue({ id: 'order-1', status: 'PENDING' });

      const result = await controller.batchRefreshStatus({ transaction_ids: ['tx-1'] }, mockUser);
      expect(result.total).toBe(1);
      expect(result.success_count).toBe(1);
    });

    it('should batch cancel transactions', async () => {
      transactionRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        id: 'tx-1',
        user_id: mockUser.id,
        status: TransactionStatus.PENDING,
        order_id: 'order-1',
      });
      brokerService.cancelOrder = vi.fn().mockResolvedValue({ id: 'order-1', status: 'CANCELLED' });

      const result = await controller.batchCancel({ transaction_ids: ['tx-1'] }, mockUser);
      expect(result.total).toBe(1);
      expect(result.success_count).toBe(1);
    });
  });
});
