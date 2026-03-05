import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RiskControlService } from '../risk-control.service';
import {
  RiskLimit,
  RiskLimitType,
  Blacklist,
  BlacklistType,
  BlacklistReason,
  Position,
  Transaction,
  TransactionType,
} from '../../../models';

describe('RiskControlService', () => {
  let service: RiskControlService;
  let riskLimitRepository: jest.Mocked<Repository<RiskLimit>>;
  let blacklistRepository: jest.Mocked<Repository<Blacklist>>;
  let positionRepository: jest.Mocked<Repository<Position>>;
  let transactionRepository: jest.Mocked<Repository<Transaction>>;

  const mockUserId = 'test-user-123';
  const mockFundCode = '000001';

  beforeEach(async () => {
    const mockRiskLimitRepository = {
      find: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockBlacklistRepository = {
      find: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const mockPositionRepository = {
      find: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ totalAmount: null, count: null }),
    };

    const mockTransactionRepository = {
      find: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskControlService,
        {
          provide: getRepositoryToken(RiskLimit),
          useValue: mockRiskLimitRepository,
        },
        {
          provide: getRepositoryToken(Blacklist),
          useValue: mockBlacklistRepository,
        },
        {
          provide: getRepositoryToken(Position),
          useValue: mockPositionRepository,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
      ],
    }).compile();

    service = module.get<RiskControlService>(RiskControlService);
    riskLimitRepository = module.get(getRepositoryToken(RiskLimit));
    blacklistRepository = module.get(getRepositoryToken(Blacklist));
    positionRepository = module.get(getRepositoryToken(Position));
    transactionRepository = module.get(getRepositoryToken(Transaction));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkTradeLimit', () => {
    it('should pass when no limits are configured', async () => {
      riskLimitRepository.find.mockResolvedValue([]);

      const result = await service.checkTradeLimit(mockUserId, 1000, TransactionType.BUY);

      expect(result.passed).toBe(true);
      expect(riskLimitRepository.find).toHaveBeenCalledWith({
        where: { user_id: mockUserId, enabled: true },
      });
    });

    it('should fail when single trade limit is exceeded', async () => {
      const limits: RiskLimit[] = [
        {
          id: 'limit-1',
          user_id: mockUserId,
          type: RiskLimitType.SINGLE_TRADE_LIMIT,
          limit_value: 5000,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        } as RiskLimit,
      ];

      riskLimitRepository.find.mockResolvedValue(limits);

      const result = await service.checkTradeLimit(mockUserId, 10000, TransactionType.BUY);

      expect(result.passed).toBe(false);
      expect(result.code).toBe('SINGLE_TRADE_LIMIT_EXCEEDED');
      expect(result.message).toContain('单笔交易金额');
    });

    it('should pass when single trade limit is not exceeded', async () => {
      const limits: RiskLimit[] = [
        {
          id: 'limit-1',
          user_id: mockUserId,
          type: RiskLimitType.SINGLE_TRADE_LIMIT,
          limit_value: 5000,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        } as RiskLimit,
      ];

      riskLimitRepository.find.mockResolvedValue(limits);
      riskLimitRepository.findOne.mockResolvedValue(null);

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalAmount: '1000', count: '2' }),
      };

      transactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.checkTradeLimit(mockUserId, 3000, TransactionType.BUY);

      expect(result.passed).toBe(true);
    });

    it('should fail when daily trade limit is exceeded', async () => {
      const limits: RiskLimit[] = [
        {
          id: 'limit-1',
          user_id: mockUserId,
          type: RiskLimitType.DAILY_TRADE_LIMIT,
          limit_value: 10000,
          enabled: true,
          current_usage: 8000,
          created_at: new Date(),
          updated_at: new Date(),
        } as RiskLimit,
      ];

      riskLimitRepository.find.mockResolvedValue(limits);

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalAmount: '8000', count: '5' }),
      };

      transactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.checkTradeLimit(mockUserId, 5000, TransactionType.BUY);

      expect(result.passed).toBe(false);
      expect(result.code).toBe('DAILY_TRADE_LIMIT_EXCEEDED');
      expect(result.message).toContain('单日累计交易金额');
    });

    it('should fail when daily trade count limit is exceeded', async () => {
      const limits: RiskLimit[] = [
        {
          id: 'limit-1',
          user_id: mockUserId,
          type: RiskLimitType.DAILY_TRADE_COUNT_LIMIT,
          limit_value: 5,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        } as RiskLimit,
      ];

      riskLimitRepository.find.mockResolvedValue(limits);

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalAmount: '0', count: '5' }),
      };

      transactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.checkTradeLimit(mockUserId, 1000, TransactionType.BUY);

      expect(result.passed).toBe(false);
      expect(result.code).toBe('DAILY_TRADE_COUNT_LIMIT_EXCEEDED');
      expect(result.message).toContain('单日交易次数');
    });
  });

  describe('checkFundBlacklist', () => {
    it('should pass when fund is not in blacklist', async () => {
      blacklistRepository.find.mockResolvedValue([]);

      const result = await service.checkFundBlacklist(mockFundCode);

      expect(result.passed).toBe(true);
    });

    it('should fail when fund code is in blacklist', async () => {
      const blacklistItems: Blacklist[] = [
        {
          id: 'blacklist-1',
          type: BlacklistType.FUND_CODE,
          value: mockFundCode,
          reason: BlacklistReason.POOR_PERFORMANCE,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        } as Blacklist,
      ];

      blacklistRepository.find.mockResolvedValue(blacklistItems);

      const result = await service.checkFundBlacklist(mockFundCode);

      expect(result.passed).toBe(false);
      expect(result.code).toBe('FUND_IN_BLACKLIST');
      expect(result.message).toContain(`基金 ${mockFundCode} 在黑名单中`);
    });

    it('should pass when blacklist item is disabled', async () => {
      // When enabled: false, the repository query with where: { enabled: true } won't return it
      blacklistRepository.find.mockResolvedValue([]);

      const result = await service.checkFundBlacklist(mockFundCode);

      expect(result.passed).toBe(true);
    });

    it('should pass when blacklist item is expired', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      // Repository returns all enabled items, including expired ones
      // The service then filters out expired items
      const blacklistItems: Blacklist[] = [
        {
          id: 'blacklist-1',
          type: BlacklistType.FUND_CODE,
          value: mockFundCode,
          reason: BlacklistReason.POOR_PERFORMANCE,
          enabled: true,
          expires_at: expiredDate,
          created_at: new Date(),
          updated_at: new Date(),
        } as Blacklist,
      ];

      blacklistRepository.find.mockResolvedValue(blacklistItems);

      const result = await service.checkFundBlacklist(mockFundCode);

      expect(result.passed).toBe(true);
    });
  });

  describe('checkPositionLimit', () => {
    it('should pass when no position limit is configured', async () => {
      riskLimitRepository.findOne.mockResolvedValue(null);

      const result = await service.checkPositionLimit(mockUserId, mockFundCode, 10000);

      expect(result.passed).toBe(true);
    });

    it('should fail when position ratio limit is exceeded', async () => {
      const limit: RiskLimit = {
        id: 'limit-1',
        user_id: mockUserId,
        type: RiskLimitType.POSITION_RATIO_LIMIT,
        limit_value: 0.3, // 30%
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      } as RiskLimit;

      riskLimitRepository.findOne.mockResolvedValue(limit);

      // Mock total assets: 100000, fund position: 20000
      positionRepository.find.mockResolvedValue([
        {
          id: 'pos-1',
          user_id: mockUserId,
          fund_code: mockFundCode,
          current_value: 20000,
        },
        {
          id: 'pos-2',
          user_id: mockUserId,
          fund_code: '000002',
          current_value: 80000,
        },
      ] as any[]);

      const result = await service.checkPositionLimit(mockUserId, mockFundCode, 15000);

      expect(result.passed).toBe(false);
      expect(result.code).toBe('POSITION_RATIO_LIMIT_EXCEEDED');
      expect(result.message).toContain('持仓比例');
    });

    it('should pass when position ratio limit is not exceeded', async () => {
      const limit: RiskLimit = {
        id: 'limit-1',
        user_id: mockUserId,
        type: RiskLimitType.POSITION_RATIO_LIMIT,
        limit_value: 0.3, // 30%
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      } as RiskLimit;

      riskLimitRepository.findOne.mockResolvedValue(limit);

      // Mock total assets: 100000, fund position: 20000
      positionRepository.find.mockResolvedValue([
        {
          id: 'pos-1',
          user_id: mockUserId,
          fund_code: mockFundCode,
          current_value: 20000,
        },
        {
          id: 'pos-2',
          user_id: mockUserId,
          fund_code: '000002',
          current_value: 80000,
        },
      ] as any[]);

      const result = await service.checkPositionLimit(mockUserId, mockFundCode, 5000);

      expect(result.passed).toBe(true);
    });
  });

  describe('checkMaxDrawdown', () => {
    it('should pass when no max drawdown limit is configured', async () => {
      riskLimitRepository.findOne.mockResolvedValue(null);

      const result = await service.checkMaxDrawdown(mockUserId, 80000, 100000);

      expect(result.passed).toBe(true);
    });

    it('should fail when max drawdown is exceeded', async () => {
      const limit: RiskLimit = {
        id: 'limit-1',
        user_id: mockUserId,
        type: RiskLimitType.MAX_DRAWDOWN_LIMIT,
        limit_value: 0.15, // 15%
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      } as RiskLimit;

      riskLimitRepository.findOne.mockResolvedValue(limit);

      // Current: 80000, Peak: 100000, Drawdown: 20%
      const result = await service.checkMaxDrawdown(mockUserId, 80000, 100000);

      expect(result.passed).toBe(false);
      expect(result.code).toBe('MAX_DRAWDOWN_EXCEEDED');
      expect(result.message).toContain('当前回撤');
    });

    it('should pass when max drawdown is not exceeded', async () => {
      const limit: RiskLimit = {
        id: 'limit-1',
        user_id: mockUserId,
        type: RiskLimitType.MAX_DRAWDOWN_LIMIT,
        limit_value: 0.25, // 25%
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      } as RiskLimit;

      riskLimitRepository.findOne.mockResolvedValue(limit);

      // Current: 80000, Peak: 100000, Drawdown: 20%
      const result = await service.checkMaxDrawdown(mockUserId, 80000, 100000);

      expect(result.passed).toBe(true);
    });
  });

  describe('checkTotalAssetStopLoss', () => {
    it('should pass when no total asset stop loss is configured', async () => {
      riskLimitRepository.findOne.mockResolvedValue(null);

      const result = await service.checkTotalAssetStopLoss(mockUserId, 50000);

      expect(result.passed).toBe(true);
    });

    it('should fail when total assets fall below stop loss line', async () => {
      const limit: RiskLimit = {
        id: 'limit-1',
        user_id: mockUserId,
        type: RiskLimitType.TOTAL_ASSET_STOP_LOSS,
        limit_value: 60000,
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      } as RiskLimit;

      riskLimitRepository.findOne.mockResolvedValue(limit);

      const result = await service.checkTotalAssetStopLoss(mockUserId, 50000);

      expect(result.passed).toBe(false);
      expect(result.code).toBe('TOTAL_ASSET_STOP_LOSS_TRIGGERED');
      expect(result.message).toContain('当前总资产');
    });

    it('should pass when total assets are above stop loss line', async () => {
      const limit: RiskLimit = {
        id: 'limit-1',
        user_id: mockUserId,
        type: RiskLimitType.TOTAL_ASSET_STOP_LOSS,
        limit_value: 60000,
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      } as RiskLimit;

      riskLimitRepository.findOne.mockResolvedValue(limit);

      const result = await service.checkTotalAssetStopLoss(mockUserId, 70000);

      expect(result.passed).toBe(true);
    });
  });

  describe('getTodayTradeStats', () => {
    it('should return today trade statistics', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalAmount: '5000', count: '3' }),
      };

      transactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getTodayTradeStats(mockUserId);

      expect(result.totalAmount).toBe(5000);
      expect(result.count).toBe(3);
    });

    it('should return zeros when no trades today', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalAmount: null, count: null }),
      };

      transactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getTodayTradeStats(mockUserId);

      expect(result.totalAmount).toBe(0);
      expect(result.count).toBe(0);
    });
  });

  describe('getPositionStats', () => {
    it('should return position statistics', async () => {
      positionRepository.find.mockResolvedValue([
        {
          id: 'pos-1',
          user_id: mockUserId,
          fund_code: mockFundCode,
          current_value: 30000,
        },
        {
          id: 'pos-2',
          user_id: mockUserId,
          fund_code: '000002',
          current_value: 70000,
        },
      ] as any[]);

      const result = await service.getPositionStats(mockUserId, mockFundCode);

      expect(result.totalAssets).toBe(100000);
      expect(result.fundPosition).toBe(30000);
      expect(result.positionRatio).toBe(0.3);
    });

    it('should return zero ratio when no assets', async () => {
      positionRepository.find.mockResolvedValue([]);

      const result = await service.getPositionStats(mockUserId, mockFundCode);

      expect(result.totalAssets).toBe(0);
      expect(result.fundPosition).toBe(0);
      expect(result.positionRatio).toBe(0);
    });
  });
});
