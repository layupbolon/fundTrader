import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Fund } from '../../models';
import { FundController } from '../controllers';
import { PaginationDto } from '../pagination.dto';

describe('FundController', () => {
  let controller: FundController;
  let fundRepository: any;

  const mockFund = {
    code: '110011',
    name: '易方达沪深 300ETF 联接 A',
    type: '指数型',
    company: '易方达基金',
    manager: '林飞',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    fundRepository = {
      findOne: vi.fn(),
      findAndCount: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FundController],
      providers: [
        {
          provide: getRepositoryToken(Fund),
          useValue: fundRepository,
        },
      ],
    }).compile();

    controller = module.get<FundController>(FundController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated list of funds', async () => {
      fundRepository.findAndCount.mockResolvedValue([[mockFund], 1]);

      const pagination: PaginationDto = { page: 1, limit: 20 };
      const result = await controller.findAll(pagination);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(fundRepository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        order: { updated_at: 'DESC' },
      });
    });

    it('should handle pagination parameters correctly', async () => {
      fundRepository.findAndCount.mockResolvedValue([[mockFund], 50]);

      const pagination: PaginationDto = { page: 2, limit: 10 };
      await controller.findAll(pagination);

      expect(fundRepository.findAndCount).toHaveBeenCalledWith({
        skip: 10,
        take: 10,
        order: { updated_at: 'DESC' },
      });
    });

    it('should return empty array when no funds exist', async () => {
      fundRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await controller.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return a single fund by code', async () => {
      fundRepository.findOne.mockResolvedValue(mockFund);

      const result = await controller.findOne('110011');

      expect(result).toEqual(mockFund);
      expect(fundRepository.findOne).toHaveBeenCalledWith({
        where: { code: '110011' },
      });
    });

    it('should return null when fund not found', async () => {
      fundRepository.findOne.mockResolvedValue(null);

      const result = await controller.findOne('999999');

      expect(result).toBeNull();
    });
  });
});
