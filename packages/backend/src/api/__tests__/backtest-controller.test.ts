import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BacktestResult as BacktestResultEntity } from '../../models';
import { BacktestController } from '../controllers';
import { BacktestEngine } from '../../core/backtest/backtest.engine';
import { PaginationDto } from '../pagination.dto';

describe('BacktestController', () => {
  let controller: BacktestController;
  let backtestResultRepository: any;
  let backtestEngine: any;
  const mockUser = { id: 'user-uuid-1', username: 'testuser' };

  const mockBacktestResult = {
    id: 'backtest-uuid-1',
    user_id: 'user-uuid-1',
    strategy_id: 'strategy-uuid-1',
    fund_code: '110011',
    start_date: new Date('2026-01-01'),
    end_date: new Date('2026-03-01'),
    initial_capital: 10000,
    final_value: 12000,
    total_return: 0.2,
    annual_return: 0.25,
    max_drawdown: 0.05,
    sharpe_ratio: 1.5,
    trades_count: 10,
    created_at: new Date(),
  };

  beforeEach(async () => {
    backtestResultRepository = {
      findOne: vi.fn(),
      findAndCount: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    };

    backtestEngine = {
      runBacktest: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BacktestController],
      providers: [
        {
          provide: BacktestEngine,
          useValue: backtestEngine,
        },
        {
          provide: getRepositoryToken(BacktestResultEntity),
          useValue: backtestResultRepository,
        },
      ],
    }).compile();

    controller = module.get<BacktestController>(BacktestController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated backtest results for current user', async () => {
      backtestResultRepository.findAndCount.mockResolvedValue([[mockBacktestResult], 1]);

      const pagination: PaginationDto = { page: 1, limit: 20 };
      const result = await controller.findAll(pagination, mockUser);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(backtestResultRepository.findAndCount).toHaveBeenCalledWith({
        where: { user_id: 'user-uuid-1' },
        skip: 0,
        take: 20,
        order: { created_at: 'DESC' },
      });
    });

    it('should handle pagination parameters correctly', async () => {
      backtestResultRepository.findAndCount.mockResolvedValue([[mockBacktestResult], 50]);

      const pagination: PaginationDto = { page: 2, limit: 10 };
      await controller.findAll(pagination, mockUser);

      expect(backtestResultRepository.findAndCount).toHaveBeenCalledWith({
        where: { user_id: 'user-uuid-1' },
        skip: 10,
        take: 10,
        order: { created_at: 'DESC' },
      });
    });

    it('should return empty array when no backtest results exist', async () => {
      backtestResultRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await controller.findAll({ page: 1, limit: 20 }, mockUser);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return a single backtest result by id', async () => {
      backtestResultRepository.findOne.mockResolvedValue(mockBacktestResult);

      const result = await controller.findOne('backtest-uuid-1', mockUser);

      expect(result).toEqual(mockBacktestResult);
      expect(backtestResultRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'backtest-uuid-1', user_id: 'user-uuid-1' },
      });
    });

    it('should return null when backtest result not found', async () => {
      backtestResultRepository.findOne.mockResolvedValue(null);

      const result = await controller.findOne('nonexistent-backtest', mockUser);

      expect(result).toBeNull();
    });
  });

  describe('runBacktest', () => {
    it('should persist backtest result with current user id', async () => {
      const backtestResult = {
        initial_capital: 10000,
        final_value: 11000,
        total_return: 0.1,
        annual_return: 0.12,
        max_drawdown: 0.03,
        sharpe_ratio: 1.2,
        trades_count: 2,
        trades: [],
      };
      backtestEngine.runBacktest.mockResolvedValue(backtestResult);
      backtestResultRepository.create.mockReturnValue({
        id: 'backtest-uuid-2',
        user_id: 'user-uuid-1',
      });
      backtestResultRepository.save.mockResolvedValue({
        id: 'backtest-uuid-2',
        user_id: 'user-uuid-1',
      });

      await controller.runBacktest(
        {
          fund_code: '110011',
          start_date: '2026-01-01',
          end_date: '2026-02-01',
          initial_capital: 10000,
          strategy_config: { type: 'AUTO_INVEST', amount: 1000, frequency: 'MONTHLY' },
        },
        mockUser,
      );

      expect(backtestResultRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-uuid-1',
          fund_code: '110011',
        }),
      );
    });
  });
});
