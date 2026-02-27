import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TradingProcessor } from '../trading.processor';
import { Strategy, Position, Transaction, TransactionStatus } from '../../models';
import { AutoInvestStrategy } from '../../core/strategy/auto-invest.strategy';
import { TakeProfitStopLossStrategy } from '../../core/strategy/take-profit-stop-loss.strategy';
import { TiantianBrokerService } from '../../services/broker/tiantian.service';
import { NotifyService } from '../../services/notify/notify.service';

describe('TradingProcessor', () => {
  let processor: TradingProcessor;
  let transactionRepository: any;
  let brokerService: any;
  let notifyService: any;

  beforeEach(async () => {
    const mockStrategyRepository = {
      find: jest.fn(),
    };

    const mockPositionRepository = {
      find: jest.fn(),
    };

    transactionRepository = {
      createQueryBuilder: jest.fn(),
      update: jest.fn(),
      find: jest.fn(),
    };

    brokerService = {
      buyFund: jest.fn(),
      sellFund: jest.fn(),
      login: jest.fn(),
      keepAlive: jest.fn(),
      getOrderStatus: jest.fn(),
    };

    notifyService = {
      send: jest.fn(),
    };

    const mockAutoInvestStrategy = {
      shouldExecute: jest.fn(),
      execute: jest.fn(),
    };

    const mockTakeProfitStopLossStrategy = {
      checkTakeProfit: jest.fn(),
      checkStopLoss: jest.fn(),
      executeSell: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradingProcessor,
        {
          provide: getRepositoryToken(Strategy),
          useValue: mockStrategyRepository,
        },
        {
          provide: getRepositoryToken(Position),
          useValue: mockPositionRepository,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: transactionRepository,
        },
        {
          provide: AutoInvestStrategy,
          useValue: mockAutoInvestStrategy,
        },
        {
          provide: TakeProfitStopLossStrategy,
          useValue: mockTakeProfitStopLossStrategy,
        },
        {
          provide: TiantianBrokerService,
          useValue: brokerService,
        },
        {
          provide: NotifyService,
          useValue: notifyService,
        },
      ],
    }).compile();

    processor = module.get<TradingProcessor>(TradingProcessor);
  });

  describe('handleConfirmPendingTransactions', () => {
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    beforeEach(() => {
      transactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    });

    it('should confirm CONFIRMED transactions from broker', async () => {
      const pendingTx = {
        id: 'tx1',
        order_id: 'order1',
        fund_code: '000001',
        status: TransactionStatus.PENDING,
        submitted_at: new Date('2026-02-24'),
      };

      mockQueryBuilder.getMany.mockResolvedValue([pendingTx]);
      brokerService.getOrderStatus.mockResolvedValue({
        status: 'CONFIRMED',
        shares: 500.1234,
        price: 1.9995,
      });
      transactionRepository.update.mockResolvedValue({});
      notifyService.send.mockResolvedValue(undefined);

      await processor.handleConfirmPendingTransactions({} as any);

      expect(transactionRepository.update).toHaveBeenCalledWith('tx1', {
        status: TransactionStatus.CONFIRMED,
        confirmed_at: expect.any(Date),
        confirmed_shares: 500.1234,
        confirmed_price: 1.9995,
        shares: 500.1234,
        price: 1.9995,
      });
      expect(notifyService.send).toHaveBeenCalledWith({
        title: '交易确认成功',
        content: expect.stringContaining('000001'),
        level: 'info',
      });
    });

    it('should mark FAILED transactions', async () => {
      const pendingTx = {
        id: 'tx2',
        order_id: 'order2',
        fund_code: '000002',
        status: TransactionStatus.PENDING,
        submitted_at: new Date('2026-02-24'),
      };

      mockQueryBuilder.getMany.mockResolvedValue([pendingTx]);
      brokerService.getOrderStatus.mockResolvedValue({
        status: 'FAILED',
        reason: '余额不足',
      });
      transactionRepository.update.mockResolvedValue({});
      notifyService.send.mockResolvedValue(undefined);

      await processor.handleConfirmPendingTransactions({} as any);

      expect(transactionRepository.update).toHaveBeenCalledWith('tx2', {
        status: TransactionStatus.FAILED,
        confirmed_at: expect.any(Date),
      });
      expect(notifyService.send).toHaveBeenCalledWith({
        title: '交易确认失败',
        content: expect.stringContaining('余额不足'),
        level: 'error',
      });
    });

    it('should skip transactions without order_id', async () => {
      const pendingTx = {
        id: 'tx3',
        order_id: null,
        fund_code: '000003',
        status: TransactionStatus.PENDING,
      };

      mockQueryBuilder.getMany.mockResolvedValue([pendingTx]);

      await processor.handleConfirmPendingTransactions({} as any);

      expect(brokerService.getOrderStatus).not.toHaveBeenCalled();
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully for individual transactions', async () => {
      const pendingTx = {
        id: 'tx4',
        order_id: 'order4',
        fund_code: '000004',
        status: TransactionStatus.PENDING,
      };

      mockQueryBuilder.getMany.mockResolvedValue([pendingTx]);
      brokerService.getOrderStatus.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await processor.handleConfirmPendingTransactions({} as any);

      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('should skip still-pending transactions on broker side', async () => {
      const pendingTx = {
        id: 'tx5',
        order_id: 'order5',
        fund_code: '000005',
        status: TransactionStatus.PENDING,
      };

      mockQueryBuilder.getMany.mockResolvedValue([pendingTx]);
      brokerService.getOrderStatus.mockResolvedValue({
        status: 'PENDING',
      });

      await processor.handleConfirmPendingTransactions({} as any);

      expect(transactionRepository.update).not.toHaveBeenCalled();
    });
  });
});
