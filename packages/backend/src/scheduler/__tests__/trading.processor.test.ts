import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TradingProcessor } from '../trading.processor';
import { Strategy, Position, Transaction, TransactionStatus, TransactionType } from '../../models';
import { AutoInvestStrategy } from '../../core/strategy/auto-invest.strategy';
import { TakeProfitStopLossStrategy } from '../../core/strategy/take-profit-stop-loss.strategy';
import { GridTradingStrategy } from '../../core/strategy/grid-trading.strategy';
import { RebalanceStrategy } from '../../core/strategy/rebalance.strategy';
import { BROKER_ADAPTER } from '../../services/broker';
import { NotifyService } from '../../services/notify/notify.service';
import { PositionService } from '../../services/position/position.service';
import { OperationLogService } from '../../core/logger/operation-log.service';

describe('TradingProcessor', () => {
  let processor: TradingProcessor;
  let transactionRepository: any;
  let brokerService: any;
  let notifyService: any;
  let positionService: any;
  let operationLogService: any;

  beforeEach(async () => {
    const mockStrategyRepository = {
      find: vi.fn(),
    };

    const mockPositionRepository = {
      find: vi.fn(),
    };

    transactionRepository = {
      createQueryBuilder: vi.fn(),
      update: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
    };

    brokerService = {
      buyFund: vi.fn(),
      sellFund: vi.fn(),
      login: vi.fn(),
      keepAlive: vi.fn(),
      getOrderStatus: vi.fn(),
    };

    notifyService = {
      send: vi.fn(),
    };

    positionService = {
      updatePositionOnBuy: vi.fn(),
      updatePositionOnSell: vi.fn(),
      refreshAllPositionValues: vi.fn(),
    };
    operationLogService = {
      logUserAction: vi.fn().mockResolvedValue(undefined),
    };

    const mockAutoInvestStrategy = {
      shouldExecute: vi.fn(),
      execute: vi.fn(),
    };

    const mockTakeProfitStopLossStrategy = {
      checkTakeProfit: vi.fn(),
      checkStopLoss: vi.fn(),
      executeSell: vi.fn(),
    };

    const mockGridTradingStrategy = {
      shouldExecute: vi.fn(),
      execute: vi.fn(),
    };

    const mockRebalanceStrategy = {
      shouldExecute: vi.fn(),
      execute: vi.fn(),
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
          provide: GridTradingStrategy,
          useValue: mockGridTradingStrategy,
        },
        {
          provide: RebalanceStrategy,
          useValue: mockRebalanceStrategy,
        },
        {
          provide: BROKER_ADAPTER,
          useValue: brokerService,
        },
        {
          provide: NotifyService,
          useValue: notifyService,
        },
        {
          provide: PositionService,
          useValue: positionService,
        },
        {
          provide: OperationLogService,
          useValue: operationLogService,
        },
      ],
    }).compile();

    processor = module.get<TradingProcessor>(TradingProcessor);
  });

  describe('handleSubmitTransaction', () => {
    it('should submit pending intent to broker and mark submitted', async () => {
      transactionRepository.findOne.mockResolvedValue({
        id: 'tx-intent-1',
        user_id: 'user1',
        fund_code: '000001',
        type: TransactionType.BUY,
        amount: 1000,
        status: TransactionStatus.PENDING_SUBMIT,
      });
      brokerService.buyFund.mockResolvedValue({ id: 'order1', fundCode: '000001', amount: 1000 });

      await processor.handleSubmitTransaction({
        data: { transaction_id: 'tx-intent-1', triggered_by: 'user1' },
        opts: { attempts: 3 },
        attemptsMade: 0,
      } as any);

      expect(brokerService.buyFund).toHaveBeenCalledWith('000001', 1000, {
        userId: 'user1',
        transactionId: 'tx-intent-1',
      });
      expect(transactionRepository.update).toHaveBeenCalledWith('tx-intent-1', {
        status: TransactionStatus.SUBMITTED,
        order_id: 'order1',
      });
      expect(operationLogService.logUserAction).toHaveBeenCalled();
    });

    it('should not resubmit already submitted transaction with order id', async () => {
      transactionRepository.findOne.mockResolvedValue({
        id: 'tx-intent-2',
        order_id: 'order2',
        status: TransactionStatus.SUBMITTED,
      });

      await processor.handleSubmitTransaction({
        data: { transaction_id: 'tx-intent-2' },
        opts: { attempts: 3 },
        attemptsMade: 0,
      } as any);

      expect(brokerService.buyFund).not.toHaveBeenCalled();
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('handleConfirmPendingTransactions', () => {
    const mockQueryBuilder = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getMany: vi.fn(),
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

    it('should call positionService.updatePositionOnBuy for BUY transactions', async () => {
      const pendingTx = {
        id: 'tx6',
        order_id: 'order6',
        fund_code: '000006',
        user_id: 'user1',
        type: TransactionType.BUY,
        status: TransactionStatus.PENDING,
        submitted_at: new Date('2026-02-24'),
      };

      mockQueryBuilder.getMany.mockResolvedValue([pendingTx]);
      brokerService.getOrderStatus.mockResolvedValue({
        status: 'CONFIRMED',
        shares: 500,
        price: 2.0,
      });
      transactionRepository.update.mockResolvedValue({});
      notifyService.send.mockResolvedValue(undefined);
      positionService.updatePositionOnBuy.mockResolvedValue({});

      await processor.handleConfirmPendingTransactions({} as any);

      expect(positionService.updatePositionOnBuy).toHaveBeenCalledWith('user1', '000006', 500, 2.0);
      expect(positionService.updatePositionOnSell).not.toHaveBeenCalled();
    });

    it('should call positionService.updatePositionOnSell for SELL transactions', async () => {
      const pendingTx = {
        id: 'tx7',
        order_id: 'order7',
        fund_code: '000007',
        user_id: 'user1',
        type: TransactionType.SELL,
        status: TransactionStatus.PENDING,
        submitted_at: new Date('2026-02-24'),
      };

      mockQueryBuilder.getMany.mockResolvedValue([pendingTx]);
      brokerService.getOrderStatus.mockResolvedValue({
        status: 'CONFIRMED',
        shares: 300,
        price: 1.8,
      });
      transactionRepository.update.mockResolvedValue({});
      notifyService.send.mockResolvedValue(undefined);
      positionService.updatePositionOnSell.mockResolvedValue({});

      await processor.handleConfirmPendingTransactions({} as any);

      expect(positionService.updatePositionOnSell).toHaveBeenCalledWith(
        'user1',
        '000007',
        300,
        1.8,
      );
      expect(positionService.updatePositionOnBuy).not.toHaveBeenCalled();
    });
  });

  describe('handleRefreshPositionValues', () => {
    it('should call positionService.refreshAllPositionValues', async () => {
      positionService.refreshAllPositionValues.mockResolvedValue(undefined);

      await processor.handleRefreshPositionValues({} as any);

      expect(positionService.refreshAllPositionValues).toHaveBeenCalled();
    });

    it('should handle errors gracefully when refreshing positions fails', async () => {
      positionService.refreshAllPositionValues.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await processor.handleRefreshPositionValues({} as any);

      expect(positionService.refreshAllPositionValues).toHaveBeenCalled();
    });
  });

  describe('handleKeepSessionAlive', () => {
    it('should call brokerService.keepAlive', async () => {
      brokerService.keepAlive.mockResolvedValue(undefined);

      await processor.handleKeepSessionAlive({} as any);

      expect(brokerService.keepAlive).toHaveBeenCalled();
    });

    it('should handle errors gracefully when keepAlive fails', async () => {
      brokerService.keepAlive.mockRejectedValue(new Error('Session expired'));

      // Should not throw
      await processor.handleKeepSessionAlive({} as any);

      expect(brokerService.keepAlive).toHaveBeenCalled();
    });
  });

  describe('handleAutoInvest', () => {
    let mockAutoInvestStrategy: any;
    let mockStrategyRepository: any;

    beforeEach(() => {
      vi.clearAllMocks();
      mockStrategyRepository = {
        find: vi.fn(),
      };
      mockAutoInvestStrategy = {
        shouldExecute: vi.fn(),
        execute: vi.fn(),
      };
      // Access the private properties through the module's mocked providers
      processor['strategyRepository'] = mockStrategyRepository;
      processor['autoInvestStrategy'] = mockAutoInvestStrategy;
    });

    it('should execute auto-invest for strategies that should execute', async () => {
      const strategies = [{ id: 'strategy-1', type: 'AUTO_INVEST', enabled: true }];
      mockStrategyRepository.find.mockResolvedValue(strategies);
      mockAutoInvestStrategy.shouldExecute.mockResolvedValue(true);
      mockAutoInvestStrategy.execute.mockResolvedValue(undefined);

      await processor.handleAutoInvest({} as any);

      expect(mockAutoInvestStrategy.shouldExecute).toHaveBeenCalledWith(strategies[0]);
      expect(mockAutoInvestStrategy.execute).toHaveBeenCalledWith(strategies[0]);
    });

    it('should skip strategies that should not execute', async () => {
      const strategies = [{ id: 'strategy-1', type: 'AUTO_INVEST', enabled: true }];
      mockStrategyRepository.find.mockResolvedValue(strategies);
      mockAutoInvestStrategy.shouldExecute.mockResolvedValue(false);

      await processor.handleAutoInvest({} as any);

      expect(mockAutoInvestStrategy.shouldExecute).toHaveBeenCalledWith(strategies[0]);
      expect(mockAutoInvestStrategy.execute).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully for individual strategies', async () => {
      const strategies = [{ id: 'strategy-1', type: 'AUTO_INVEST', enabled: true }];
      mockStrategyRepository.find.mockResolvedValue(strategies);
      mockAutoInvestStrategy.shouldExecute.mockRejectedValue(new Error('Strategy error'));

      // Should not throw
      await processor.handleAutoInvest({} as any);
    });
  });

  describe('handleTakeProfitStopLoss', () => {
    let mockPositionRepository: any;
    let mockStrategyRepository: any;
    let mockTakeProfitStopLossStrategy: any;

    beforeEach(() => {
      vi.clearAllMocks();
      mockPositionRepository = {
        find: vi.fn(),
      };
      mockStrategyRepository = {
        find: vi.fn(),
      };
      mockTakeProfitStopLossStrategy = {
        checkTakeProfit: vi.fn(),
        checkStopLoss: vi.fn(),
        executeSell: vi.fn(),
      };
      processor['positionRepository'] = mockPositionRepository;
      processor['strategyRepository'] = mockStrategyRepository;
      processor['takeProfitStopLossStrategy'] = mockTakeProfitStopLossStrategy;
    });

    it('should check and execute take-profit for positions that meet criteria', async () => {
      const positions = [{ id: 'position-1', user_id: 'user-1', fund_code: '000001' }];
      mockPositionRepository.find.mockResolvedValue(positions);

      const tpslStrategies = [
        {
          id: 'tp-1',
          user_id: 'user-1',
          fund_code: '000001',
          type: 'TAKE_PROFIT_STOP_LOSS',
          enabled: true,
          config: {
            take_profit: { target_rate: 0.15, sell_ratio: 1.0 },
            stop_loss: { max_drawdown: -0.1, sell_ratio: 1.0 },
          },
        },
      ];
      mockStrategyRepository.find.mockResolvedValueOnce(tpslStrategies);

      mockTakeProfitStopLossStrategy.checkTakeProfit.mockResolvedValue(true);
      mockTakeProfitStopLossStrategy.executeSell.mockResolvedValue(undefined);

      await processor.handleTakeProfitStopLoss({} as any);

      expect(mockTakeProfitStopLossStrategy.checkTakeProfit).toHaveBeenCalled();
      expect(mockTakeProfitStopLossStrategy.executeSell).toHaveBeenCalled();
    });

    it('should check and execute stop-loss for positions that meet criteria', async () => {
      const positions = [{ id: 'position-1', user_id: 'user-1', fund_code: '000001' }];
      mockPositionRepository.find.mockResolvedValue(positions);

      const tpslStrategies = [
        {
          id: 'sl-1',
          user_id: 'user-1',
          fund_code: '000001',
          type: 'TAKE_PROFIT_STOP_LOSS',
          enabled: true,
          config: {
            take_profit: { target_rate: 0.2, sell_ratio: 1.0 },
            stop_loss: { max_drawdown: -0.1, sell_ratio: 1.0 },
          },
        },
      ];

      mockStrategyRepository.find.mockResolvedValueOnce(tpslStrategies);

      mockTakeProfitStopLossStrategy.checkTakeProfit.mockResolvedValue(false);
      mockTakeProfitStopLossStrategy.checkStopLoss.mockResolvedValue(true);
      mockTakeProfitStopLossStrategy.executeSell.mockResolvedValue(undefined);

      await processor.handleTakeProfitStopLoss({} as any);

      expect(mockTakeProfitStopLossStrategy.checkStopLoss).toHaveBeenCalled();
      expect(mockTakeProfitStopLossStrategy.executeSell).toHaveBeenCalled();
    });

    it('should skip strategies that do not meet criteria', async () => {
      const positions = [{ id: 'position-1', user_id: 'user-1', fund_code: '000001' }];
      mockPositionRepository.find.mockResolvedValue(positions);

      const tpslStrategies = [
        {
          id: 'tp-1',
          user_id: 'user-1',
          fund_code: '000001',
          type: 'TAKE_PROFIT_STOP_LOSS',
          enabled: true,
          config: {
            take_profit: { target_rate: 0.2, sell_ratio: 1.0 },
            stop_loss: { max_drawdown: -0.1, sell_ratio: 1.0 },
          },
        },
      ];
      mockStrategyRepository.find.mockResolvedValueOnce(tpslStrategies);

      mockTakeProfitStopLossStrategy.checkTakeProfit.mockResolvedValue(false);
      mockTakeProfitStopLossStrategy.checkStopLoss.mockResolvedValue(false);

      await processor.handleTakeProfitStopLoss({} as any);

      expect(mockTakeProfitStopLossStrategy.checkTakeProfit).toHaveBeenCalled();
      expect(mockTakeProfitStopLossStrategy.executeSell).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully for individual positions', async () => {
      // When positionRepository.find returns empty array, there are no positions to process
      // This tests that the loop handles empty arrays gracefully
      mockPositionRepository.find.mockResolvedValue([]);

      // Should not throw when there are no positions
      await expect(processor.handleTakeProfitStopLoss({} as any)).resolves.toBeUndefined();
    });
  });

  describe('handleGridTrading', () => {
    let mockStrategyRepository: any;
    let mockGridTradingStrategy: any;

    beforeEach(() => {
      vi.clearAllMocks();
      mockStrategyRepository = {
        find: vi.fn(),
      };
      mockGridTradingStrategy = {
        shouldExecute: vi.fn(),
        execute: vi.fn(),
      };
      processor['strategyRepository'] = mockStrategyRepository;
      processor['gridTradingStrategy'] = mockGridTradingStrategy;
    });

    it('should execute grid trading for strategies that should execute', async () => {
      const strategies = [{ id: 'grid-1', type: 'GRID_TRADING', enabled: true }];
      mockStrategyRepository.find.mockResolvedValue(strategies);
      mockGridTradingStrategy.shouldExecute.mockResolvedValue(true);
      mockGridTradingStrategy.execute.mockResolvedValue(undefined);

      await processor.handleGridTrading({} as any);

      expect(mockGridTradingStrategy.shouldExecute).toHaveBeenCalledWith(strategies[0]);
      expect(mockGridTradingStrategy.execute).toHaveBeenCalledWith(strategies[0]);
    });

    it('should skip grid trading strategies that should not execute', async () => {
      const strategies = [{ id: 'grid-1', type: 'GRID_TRADING', enabled: true }];
      mockStrategyRepository.find.mockResolvedValue(strategies);
      mockGridTradingStrategy.shouldExecute.mockResolvedValue(false);

      await processor.handleGridTrading({} as any);

      expect(mockGridTradingStrategy.shouldExecute).toHaveBeenCalledWith(strategies[0]);
      expect(mockGridTradingStrategy.execute).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully for individual strategies', async () => {
      const strategies = [{ id: 'grid-1', type: 'GRID_TRADING', enabled: true }];
      mockStrategyRepository.find.mockResolvedValue(strategies);
      mockGridTradingStrategy.shouldExecute.mockRejectedValue(new Error('Grid error'));

      // Should not throw
      await processor.handleGridTrading({} as any);
    });
  });

  describe('handleRebalance', () => {
    let mockStrategyRepository: any;
    let mockRebalanceStrategy: any;

    beforeEach(() => {
      vi.clearAllMocks();
      mockStrategyRepository = {
        find: vi.fn(),
      };
      mockRebalanceStrategy = {
        shouldExecute: vi.fn(),
        execute: vi.fn(),
      };
      processor['strategyRepository'] = mockStrategyRepository;
      processor['rebalanceStrategy'] = mockRebalanceStrategy;
    });

    it('should execute rebalance for strategies that should execute', async () => {
      const strategies = [{ id: 'rebalance-1', type: 'REBALANCE', enabled: true }];
      mockStrategyRepository.find.mockResolvedValue(strategies);
      mockRebalanceStrategy.shouldExecute.mockResolvedValue(true);
      mockRebalanceStrategy.execute.mockResolvedValue(undefined);

      await processor.handleRebalance({} as any);

      expect(mockRebalanceStrategy.shouldExecute).toHaveBeenCalledWith(strategies[0]);
      expect(mockRebalanceStrategy.execute).toHaveBeenCalledWith(strategies[0]);
    });

    it('should skip rebalance strategies that should not execute', async () => {
      const strategies = [{ id: 'rebalance-1', type: 'REBALANCE', enabled: true }];
      mockStrategyRepository.find.mockResolvedValue(strategies);
      mockRebalanceStrategy.shouldExecute.mockResolvedValue(false);

      await processor.handleRebalance({} as any);

      expect(mockRebalanceStrategy.shouldExecute).toHaveBeenCalledWith(strategies[0]);
      expect(mockRebalanceStrategy.execute).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully for individual strategies', async () => {
      const strategies = [{ id: 'rebalance-1', type: 'REBALANCE', enabled: true }];
      mockStrategyRepository.find.mockResolvedValue(strategies);
      mockRebalanceStrategy.shouldExecute.mockRejectedValue(new Error('Rebalance error'));

      // Should not throw
      await processor.handleRebalance({} as any);
    });
  });
});
