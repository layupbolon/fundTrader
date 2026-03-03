import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Transaction, TransactionType, TransactionStatus } from '../../models';
import { TransactionController } from '../controllers';
import { PaginationDto } from '../pagination.dto';

describe('TransactionController', () => {
  let controller: TransactionController;
  let transactionRepository: any;

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
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        {
          provide: getRepositoryToken(Transaction),
          useValue: transactionRepository,
        },
      ],
    }).compile();

    controller = module.get<TransactionController>(TransactionController);
  });

  afterEach(() => {
    jest.clearAllMocks();
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
    it('should return a single transaction by id', async () => {
      transactionRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await controller.findOne('tx-uuid-1');

      expect(result).toEqual(mockTransaction);
      expect(transactionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'tx-uuid-1' },
        relations: ['fund', 'strategy', 'user'],
      });
    });

    it('should return null when transaction not found', async () => {
      transactionRepository.findOne.mockResolvedValue(null);

      const result = await controller.findOne('nonexistent-tx');

      expect(result).toBeNull();
    });
  });
});
