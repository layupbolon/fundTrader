import { Test, TestingModule } from '@nestjs/testing';
import { ConfirmationProcessor } from '../confirmation.processor';
import { TradingConfirmationService } from '../../core/trading/trading-confirmation.service';

describe('ConfirmationProcessor', () => {
  let processor: ConfirmationProcessor;
  let tradingConfirmationService: TradingConfirmationService;

  const tradingConfirmationServiceMock = {
    cancelTimeoutTransactions: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfirmationProcessor,
        {
          provide: TradingConfirmationService,
          useValue: tradingConfirmationServiceMock,
        },
      ],
    }).compile();

    processor = module.get<ConfirmationProcessor>(ConfirmationProcessor);
    tradingConfirmationService = module.get<TradingConfirmationService>(TradingConfirmationService);

    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('handleCheckConfirmationTimeout', () => {
    it('should call cancelTimeoutTransactions and return the count', async () => {
      tradingConfirmationServiceMock.cancelTimeoutTransactions.mockResolvedValue(3);

      const mockJob = {
        data: {},
        id: 'test-job-id',
        log: vi.fn(),
        update: vi.fn(),
      } as any;

      const result = await processor.handleCheckConfirmationTimeout(mockJob);

      expect(tradingConfirmationService.cancelTimeoutTransactions).toHaveBeenCalledTimes(1);
      expect(result).toBe(3);
    });

    it('should return 0 when no timeout transactions found', async () => {
      tradingConfirmationServiceMock.cancelTimeoutTransactions.mockResolvedValue(0);

      const mockJob = {
        data: {},
        id: 'test-job-id',
        log: vi.fn(),
        update: vi.fn(),
      } as any;

      const result = await processor.handleCheckConfirmationTimeout(mockJob);

      expect(tradingConfirmationService.cancelTimeoutTransactions).toHaveBeenCalledTimes(1);
      expect(result).toBe(0);
    });

    it('should throw error when cancelTimeoutTransactions fails', async () => {
      const error = new Error('Database connection failed');
      tradingConfirmationServiceMock.cancelTimeoutTransactions.mockRejectedValue(error);

      const mockJob = {
        data: {},
        id: 'test-job-id',
        log: vi.fn(),
        update: vi.fn(),
      } as any;

      await expect(processor.handleCheckConfirmationTimeout(mockJob)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });
});
