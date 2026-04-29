import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AnalyticsService } from '../analytics.service';
import { PortfolioSnapshot, Position, Transaction } from '../../../models';
import { TransactionType } from '../../../models';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let portfolioSnapshotRepository: jest.Mocked<Repository<PortfolioSnapshot>>;
  let positionRepository: jest.Mocked<Repository<Position>>;
  let transactionRepository: jest.Mocked<Repository<Transaction>>;

  const mockUserId = 'test-user-id';
  const mockStartDate = '2026-01-01';
  const mockEndDate = '2026-03-04';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(PortfolioSnapshot),
          useValue: {
            find: vi.fn(),
            create: vi.fn(),
            save: vi.fn(),
            findOne: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(Position),
          useValue: {
            find: vi.fn(),
            createQueryBuilder: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            createQueryBuilder: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    portfolioSnapshotRepository = module.get(getRepositoryToken(PortfolioSnapshot));
    positionRepository = module.get(getRepositoryToken(Position));
    transactionRepository = module.get(getRepositoryToken(Transaction));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getReturnsData', () => {
    it('should return returns data for the specified date range', async () => {
      const mockSnapshots = [
        {
          id: '1',
          user_id: mockUserId,
          user: null,
          total_assets: 100000,
          total_profit: 5000,
          total_profit_rate: 0.05,
          total_cost: 95000,
          position_count: 3,
          snapshot_date: new Date('2026-01-15'),
          created_at: new Date(),
        },
        {
          id: '2',
          user_id: mockUserId,
          user: null,
          total_assets: 110000,
          total_profit: 10000,
          total_profit_rate: 0.1,
          total_cost: 100000,
          position_count: 4,
          snapshot_date: new Date('2026-02-15'),
          created_at: new Date(),
        },
      ] as PortfolioSnapshot[];

      portfolioSnapshotRepository.find.mockResolvedValue(mockSnapshots);

      const result = await service.getReturnsData(mockUserId, mockStartDate, mockEndDate);

      expect(portfolioSnapshotRepository.find).toHaveBeenCalledWith({
        where: {
          user_id: mockUserId,
          snapshot_date: Between(new Date(mockStartDate), new Date(mockEndDate)),
        },
        order: {
          snapshot_date: 'ASC',
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '2026-01-15',
        total_assets: 100000,
        total_profit: 5000,
        total_profit_rate: 0.05,
        position_count: 3,
      });
      expect(result[1]).toEqual({
        date: '2026-02-15',
        total_assets: 110000,
        total_profit: 10000,
        total_profit_rate: 0.1,
        position_count: 4,
      });
    });

    it('should return empty array when no snapshots exist', async () => {
      portfolioSnapshotRepository.find.mockResolvedValue([]);

      const result = await service.getReturnsData(mockUserId, mockStartDate, mockEndDate);

      expect(result).toHaveLength(0);
    });
  });

  describe('getPositionAnalysis', () => {
    it('should return position analysis with correct ratios', async () => {
      const mockPositions = [
        {
          id: '1',
          user_id: mockUserId,
          fund_code: '000001',
          shares: 1000,
          cost: 10000,
          current_value: 12000,
          profit: 2000,
          profit_rate: 0.2,
          fund: { name: '华夏成长混合' },
        },
        {
          id: '2',
          user_id: mockUserId,
          fund_code: '000002',
          shares: 500,
          cost: 5000,
          current_value: 8000,
          profit: 3000,
          profit_rate: 0.6,
          fund: { name: '易方达蓝筹精选' },
        },
      ];

      const queryBuilderMock = {
        innerJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(mockPositions),
      };

      positionRepository.createQueryBuilder.mockReturnValue(queryBuilderMock as any);

      const result = await service.getPositionAnalysis(mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        fund_code: '000001',
        fund_name: '华夏成长混合',
        current_value: 12000,
        position_ratio: 0.6, // 12000 / 20000
        profit: 2000,
        profit_rate: 0.2,
      });
      expect(result[1]).toEqual({
        fund_code: '000002',
        fund_name: '易方达蓝筹精选',
        current_value: 8000,
        position_ratio: 0.4, // 8000 / 20000
        profit: 3000,
        profit_rate: 0.6,
      });
    });

    it('should return empty array when no positions exist', async () => {
      const queryBuilderMock = {
        innerJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      };

      positionRepository.createQueryBuilder.mockReturnValue(queryBuilderMock as any);

      const result = await service.getPositionAnalysis(mockUserId);

      expect(result).toHaveLength(0);
    });
  });

  describe('getTransactionStats', () => {
    it('should return transaction stats for buy and sell', async () => {
      const mockBuyStats = {
        success_count: '8',
        failed_count: '2',
        total_count: '10',
        total_amount: '100000',
      };

      const mockSellStats = {
        success_count: '4',
        failed_count: '1',
        total_count: '5',
        total_amount: '50000',
      };

      const queryBuilderMock = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        setParameter: vi.fn().mockReturnThis(),
        setParameters: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValueOnce(mockBuyStats).mockResolvedValueOnce(mockSellStats),
      };

      transactionRepository.createQueryBuilder.mockReturnValue(queryBuilderMock as any);

      const result = await service.getTransactionStats(mockUserId, mockStartDate, mockEndDate);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        type: TransactionType.BUY,
        count: 10,
        total_amount: 100000,
        success_count: 8,
        failed_count: 2,
      });
      expect(result[1]).toEqual({
        type: TransactionType.SELL,
        count: 5,
        total_amount: 50000,
        success_count: 4,
        failed_count: 1,
      });
    });

    it('should return zeros when no transactions exist', async () => {
      const mockEmptyStats = {
        success_count: '0',
        failed_count: '0',
        total_count: '0',
        total_amount: '0',
      };

      const queryBuilderMock = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        setParameter: vi.fn().mockReturnThis(),
        setParameters: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValue(mockEmptyStats),
      };

      transactionRepository.createQueryBuilder.mockReturnValue(queryBuilderMock as any);

      const result = await service.getTransactionStats(mockUserId, mockStartDate, mockEndDate);

      expect(result[0].count).toBe(0);
      expect(result[1].count).toBe(0);
    });
  });

  describe('createSnapshot', () => {
    it('should create a portfolio snapshot from current positions', async () => {
      const mockPositions = [
        {
          id: '1',
          user_id: mockUserId,
          fund_code: '000001',
          shares: 1000,
          cost: 10000,
          current_value: 12000,
          profit: 2000,
          profit_rate: 0.2,
        },
        {
          id: '2',
          user_id: mockUserId,
          fund_code: '000002',
          shares: 0,
          cost: 0,
          current_value: 0,
          profit: 0,
          profit_rate: 0,
        },
      ];

      positionRepository.find.mockResolvedValue(mockPositions as any);

      const mockCreatedSnapshot = {
        id: 'snapshot-id',
        user_id: mockUserId,
        total_assets: 12000,
        total_profit: 2000,
        total_profit_rate: 0.2,
        total_cost: 10000,
        position_count: 1,
        snapshot_date: expect.any(Date),
      };

      portfolioSnapshotRepository.create.mockReturnValue(mockCreatedSnapshot as any);
      portfolioSnapshotRepository.save.mockResolvedValue(mockCreatedSnapshot as any);

      const result = await service.createSnapshot(mockUserId);

      expect(positionRepository.find).toHaveBeenCalledWith({
        where: { user_id: mockUserId },
      });

      expect(portfolioSnapshotRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUserId,
          total_assets: 12000,
          total_profit: 2000,
          total_profit_rate: 0.2,
          total_cost: 10000,
          position_count: 1,
        }),
      );

      expect(result).toEqual(mockCreatedSnapshot);
    });

    it('should handle empty positions', async () => {
      positionRepository.find.mockResolvedValue([]);

      const mockCreatedSnapshot = {
        id: 'snapshot-id',
        user_id: mockUserId,
        total_assets: 0,
        total_profit: 0,
        total_profit_rate: 0,
        total_cost: 0,
        position_count: 0,
        snapshot_date: expect.any(Date),
      };

      portfolioSnapshotRepository.create.mockReturnValue(mockCreatedSnapshot as any);
      portfolioSnapshotRepository.save.mockResolvedValue(mockCreatedSnapshot as any);

      const result = await service.createSnapshot(mockUserId);

      expect(result.total_assets).toBe(0);
      expect(result.position_count).toBe(0);
    });
  });

  describe('getLatestSnapshot', () => {
    it('should return the latest snapshot', async () => {
      const mockSnapshot = {
        id: 'latest-snapshot',
        user_id: mockUserId,
        user: null,
        total_assets: 150000,
        total_profit: 15000,
        total_profit_rate: 0.1,
        total_cost: 135000,
        position_count: 5,
        snapshot_date: new Date('2026-03-04'),
        created_at: new Date(),
      } as PortfolioSnapshot;

      portfolioSnapshotRepository.findOne.mockResolvedValue(mockSnapshot);

      const result = await service.getLatestSnapshot(mockUserId);

      expect(portfolioSnapshotRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: mockUserId },
        order: { snapshot_date: 'DESC' },
      });

      expect(result).toEqual(mockSnapshot);
    });

    it('should return null when no snapshots exist', async () => {
      portfolioSnapshotRepository.findOne.mockResolvedValue(null);

      const result = await service.getLatestSnapshot(mockUserId);

      expect(result).toBeNull();
    });
  });
});
