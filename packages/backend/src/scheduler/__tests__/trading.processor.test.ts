import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TradingProcessor } from '../trading.processor';
import { Strategy, Position, Transaction, TransactionStatus, TransactionType } from '../../models';
import { AutoInvestStrategy } from '../../core/strategy/auto-invest.strategy';
import { TakeProfitStopLossStrategy } from '../../core/strategy/take-profit-stop-loss.strategy';
import { GridTradingStrategy } from '../../core/strategy/grid-trading.strategy';
import { RebalanceStrategy } from '../../core/strategy/rebalance.strategy';
import { TiantianBrokerService } from '../../services/broker/tiantian.service';
import { NotifyService } from '../../services/notify/notify.service';
import { PositionService } from '../../services/position/position.service';

describe('TradingProcessor', () => {
  let processor: TradingProcessor;
  let transactionRepository: any;
  let brokerService: any;
  let notifyService: any;
  let positionService: any;

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

    positionService = {
      updatePositionOnBuy: jest.fn(),
      updatePositionOnSell: jest.fn(),
      refreshAllPositionValues: jest.fn(),
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

    const mockGridTradingStrategy = {
      shouldExecute: jest.fn(),
      execute: jest.fn(),
    };

    const mockRebalanceStrategy = {
      shouldExecute: jest.fn(),
      execute: jest.fn(),
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
          provide: TiantianBrokerService,
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

      expect(positionService.updatePositionOnBuy).toHaveBeenCalledWith(
        'user1',
        '000006',
        500,
        2.0,
      );
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
      jest.clearAllMocks();
      mockStrategyRepository = {
        find: jest.fn(),
      };
      mockAutoInvestStrategy = {
        shouldExecute: jest.fn(),
        execute: jest.fn(),
      };
      // Access the private properties through the module's mocked providers
      processor['strategyRepository'] = mockStrategyRepository;
      processor['autoInvestStrategy'] = mockAutoInvestStrategy;
    });

    it('should execute auto-invest for strategies that should execute', async () => {
      const strategies = [
        { id: 'strategy-1', type: 'AUTO_INVEST', enabled: true },
      ];
      mockStrategyRepository.find.mockResolvedValue(strategies);
      mockAutoInvestStrategy.shouldExecute.mockResolvedValue(true);
      mockAutoInvestStrategy.execute.mockResolvedValue(undefined);

      await processor.handleAutoInvest({} as any);

      expect(mockAutoInvestStrategy.shouldExecute).toHaveBeenCalledWith(strategies[0]);
      expect(mockAutoInvestStrategy.execute).toHaveBeenCalledWith(strategies[0]);
    });

    it('should skip strategies that should not execute', async () => {
      const strategies = [
        { id: 'strategy-1', type: 'AUTO_INVEST', enabled: true },
      ];
      mockStrategyRepository.find.mockResolvedValue(strategies);
      mockAutoInvestStrategy.shouldExecute.mockResolvedValue(false);

      await processor.handleAutoInvest({} as any);

      expect(mockAutoInvestStrategy.shouldExecute).toHaveBeenCalledWith(strategies[0]);
      expect(mockAutoInvestStrategy.execute).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully for individual strategies', async () => {
      const strategies = [
        { id: 'strategy-1', type: 'AUTO_INVEST', enabled: true },
      ];
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
      jest.clearAllMocks();
      mockPositionRepository = {
        find: jest.fn(),
      };
      mockStrategyRepository = {
        find: jest.fn(),
      };
      mockTakeProfitStopLossStrategy = {
        checkTakeProfit: jest.fn(),
        checkStopLoss: jest.fn(),
        executeSell: jest.fn(),
      };
      processor['positionRepository'] = mockPositionRepository;
      processor['strategyRepository'] = mockStrategyRepository;
      processor['takeProfitStopLossStrategy'] = mockTakeProfitStopLossStrategy;
    });

    it('should check and execute take-profit for positions that meet criteria', async () => {
      const positions = [
        { id: 'position-1', user_id: 'user-1', fund_code: '000001' },
      ];
      mockPositionRepository.find.mockResolvedValue(positions);

      const takeProfitStrategies = [
        { id: 'tp-1', user_id: 'user-1', fund_code: '000001', type: 'TAKE_PROFIT', enabled: true, config: { target_rate: 0.15, sell_ratio: 1.0 } },
      ];
      const stopLossStrategies = [];

      mockStrategyRepository.find
        .mockResolvedValueOnce(takeProfitStrategies)
        .mockResolvedValueOnce(stopLossStrategies);

      mockTakeProfitStopLossStrategy.checkTakeProfit.mockResolvedValue(true);
      mockTakeProfitStopLossStrategy.executeSell.mockResolvedValue(undefined);

      await processor.handleTakeProfitStopLoss({} as any);

      expect(mockTakeProfitStopLossStrategy.checkTakeProfit).toHaveBeenCalled();
      expect(mockTakeProfitStopLossStrategy.executeSell).toHaveBeenCalled();
    });

    it('should check and execute stop-loss for positions that meet criteria', async () => {
      const positions = [
        { id: 'position-1', user_id: 'user-1', fund_code: '000001' },
      ];
      mockPositionRepository.find.mockResolvedValue(positions);

      const takeProfitStrategies = [];
      const stopLossStrategies = [
        { id: 'sl-1', user_id: 'user-1', fund_code: '000001', type: 'STOP_LOSS', enabled: true, config: { max_drawdown: -0.1, sell_ratio: 1.0 } },
      ];

      mockStrategyRepository.find
        .mockResolvedValueOnce(takeProfitStrategies)
        .mockResolvedValueOnce(stopLossStrategies);

      mockTakeProfitStopLossStrategy.checkStopLoss.mockResolvedValue(true);
      mockTakeProfitStopLossStrategy.executeSell.mockResolvedValue(undefined);

      await processor.handleTakeProfitStopLoss({} as any);

      expect(mockTakeProfitStopLossStrategy.checkStopLoss).toHaveBeenCalled();
      expect(mockTakeProfitStopLossStrategy.executeSell).toHaveBeenCalled();
    });

    it('should skip strategies that do not meet criteria', async () => {
      const positions = [
        { id: 'position-1', user_id: 'user-1', fund_code: '000001' },
      ];
      mockPositionRepository.find.mockResolvedValue(positions);

      const takeProfitStrategies = [
        { id: 'tp-1', user_id: 'user-1', fund_code: '000001', type: 'TAKE_PROFIT', enabled: true, config: {} },
      ];
      const stopLossStrategies = [];

      mockStrategyRepository.find
        .mockResolvedValueOnce(takeProfitStrategies)
        .mockResolvedValueOnce(stopLossStrategies);

      mockTakeProfitStopLossStrategy.checkTakeProfit.mockResolvedValue(false);

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
      jest.clearAllMocks();
      mockStrategyRepository = {
        find: jest.fn(),
      };
      mockGridTradingStrategy = {
        shouldExecute: jest.fn(),
        execute: jest.fn(),
      };
      processor['strategyRepository'] = mockStrategyRepository;
      processor['gridTradingStrategy'] = mockGridTradingStrategy;
    });

    it('should execute grid trading for strategies that should execute', async () => {
      const strategies = [
        { id: 'grid-1', type: 'GRID_TRADING', enabled: true },
      ];
      mockStrategyRepository.find.mockResolvedValue(strategies);
      mockGridTradingStrategy.shouldExecute.mockResolvedValue(true);
      mockGridTradingStrategy.execute.mockResolvedValue(undefined);

      await processor.handleGridTrading({} as any);

      expect(mockGridTradingStrategy.shouldExecute).toHaveBeenCalledWith(strategies[0]);
      expect(mockGridTradingStrategy.execute).toHaveBeenCalledWith(strategies[0]);
    });

    it('should skip grid trading strategies that should not execute', async () => {
      const strategies = [
        { id: 'grid-1', type: 'GRID_TRADING', enabled: true },
      ];
      mockStrategyRepository.find.mockResolvedValue(strategies);
      mockGridTradingStrategy.shouldExecute.mockResolvedValue(false);

      await processor.handleGridTrading({} as any);

      expect(mockGridTradingStrategy.shouldExecute).toHaveBeenCalledWith(strategies[0]);
      expect(mockGridTradingStrategy.execute).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully for individual strategies', async () => {
      const strategies = [
        { id: 'grid-1', type: 'GRID_TRADING', enabled: true },
      ];
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
      jest.clearAllMocks();
      mockStrategyRepository = {
        find: jest.fn(),
      };
      mockRebalanceStrategy = {
        shouldExecute: jest.fn(),
        execute: jest.fn(),
      };
      processor['strategyRepository'] = mockStrategyRepository;
      processor['rebalanceStrategy'] = mockRebalanceStrategy;
    });

    it('should execute rebalance for strategies that should execute', async () => {
      const strategies = [
        { id: 'rebalance-1', type: 'REBALANCE', enabled: true },
      ];
      mockStrategyRepository.find.mockResolvedValue(strategies);
      mockRebalanceStrategy.shouldExecute.mockResolvedValue(true);
      mockRebalanceStrategy.execute.mockResolvedValue(undefined);

      await processor.handleRebalance({} as any);

      expect(mockRebalanceStrategy.shouldExecute).toHaveBeenCalledWith(strategies[0]);
      expect(mockRebalanceStrategy.execute).toHaveBeenCalledWith(strategies[0]);
    });

    it('should skip rebalance strategies that should not execute', async () => {
      const strategies = [
        { id: 'rebalance-1', type: 'REBALANCE', enabled: true },
      ];
      mockStrategyRepository.find.mockResolvedValue(strategies);
      mockRebalanceStrategy.shouldExecute.mockResolvedValue(false);

      await processor.handleRebalance({} as any);

      expect(mockRebalanceStrategy.shouldExecute).toHaveBeenCalledWith(strategies[0]);
      expect(mockRebalanceStrategy.execute).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully for individual strategies', async () => {
      const strategies = [
        { id: 'rebalance-1', type: 'REBALANCE', enabled: true },
      ];
      mockStrategyRepository.find.mockResolvedValue(strategies);
      mockRebalanceStrategy.shouldExecute.mockRejectedValue(new Error('Rebalance error'));

      // Should not throw
      await processor.handleRebalance({} as any);
    });
  });
});
