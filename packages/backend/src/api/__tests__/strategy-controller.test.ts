import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Strategy, StrategyType } from '../../models';
import { StrategyController } from '../controllers';

describe('StrategyController', () => {
  let controller: StrategyController;
  let strategyRepository: any;

  const mockUser = { id: 'user-uuid-1', username: 'testuser' };
  const mockStrategy = {
    id: 'strategy-uuid-1',
    user_id: 'user-uuid-1',
    name: '沪深300定投',
    type: StrategyType.AUTO_INVEST,
    fund_code: '110011',
    config: { amount: 1000, frequency: 'weekly', day_of_week: 1 },
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    strategyRepository = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StrategyController],
      providers: [
        {
          provide: getRepositoryToken(Strategy),
          useValue: strategyRepository,
        },
      ],
    }).compile();

    controller = module.get<StrategyController>(StrategyController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated strategies for current user', async () => {
      strategyRepository.findAndCount.mockResolvedValue([[mockStrategy], 1]);

      const result = await controller.findAll({ page: 1, limit: 20 }, mockUser);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(strategyRepository.findAndCount).toHaveBeenCalledWith({
        where: { user_id: 'user-uuid-1' },
        relations: ['fund'],
        skip: 0,
        take: 20,
        order: { created_at: 'DESC' },
      });
    });
  });

  describe('create', () => {
    it('should create strategy with user_id from JWT', async () => {
      const createDto = {
        name: '沪深300定投',
        type: StrategyType.AUTO_INVEST,
        fund_code: '110011',
        config: { amount: 1000, frequency: 'daily' },
      };
      strategyRepository.create.mockReturnValue({ ...createDto, user_id: 'user-uuid-1' });
      strategyRepository.save.mockResolvedValue({ ...mockStrategy });

      const result = await controller.create(createDto, mockUser);

      expect(result).toBeDefined();
      expect(strategyRepository.create).toHaveBeenCalledWith({
        ...createDto,
        user_id: 'user-uuid-1',
      });
    });
  });

  describe('update', () => {
    it('should update strategy successfully', async () => {
      strategyRepository.findOne.mockResolvedValue({ ...mockStrategy });
      strategyRepository.save.mockResolvedValue({ ...mockStrategy, name: '新名称' });

      const result = await controller.update(
        'strategy-uuid-1',
        { name: '新名称' },
        mockUser,
      );

      expect(result.name).toBe('新名称');
    });

    it('should throw NotFoundException when strategy not found', async () => {
      strategyRepository.findOne.mockResolvedValue(null);

      await expect(
        controller.update('nonexistent', { name: '新名称' }, mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own strategy', async () => {
      strategyRepository.findOne.mockResolvedValue({
        ...mockStrategy,
        user_id: 'other-user-id',
      });

      await expect(
        controller.update('strategy-uuid-1', { name: '新名称' }, mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should validate config when updating config', async () => {
      strategyRepository.findOne.mockResolvedValue({ ...mockStrategy });

      // Invalid config should throw
      await expect(
        controller.update(
          'strategy-uuid-1',
          { config: { amount: 5, frequency: 'INVALID' } },
          mockUser,
        ),
      ).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('should delete strategy successfully', async () => {
      strategyRepository.findOne.mockResolvedValue({ ...mockStrategy });
      strategyRepository.remove.mockResolvedValue(undefined);

      const result = await controller.remove('strategy-uuid-1', mockUser);

      expect(result.message).toBe('Strategy deleted successfully');
      expect(strategyRepository.remove).toHaveBeenCalled();
    });

    it('should throw NotFoundException when strategy not found', async () => {
      strategyRepository.findOne.mockResolvedValue(null);

      await expect(
        controller.remove('nonexistent', mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own strategy', async () => {
      strategyRepository.findOne.mockResolvedValue({
        ...mockStrategy,
        user_id: 'other-user-id',
      });

      await expect(
        controller.remove('strategy-uuid-1', mockUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('toggle', () => {
    it('should toggle strategy enabled status', async () => {
      strategyRepository.findOne.mockResolvedValue({ ...mockStrategy, enabled: true });
      strategyRepository.save.mockResolvedValue({ ...mockStrategy, enabled: false });

      const result = await controller.toggle('strategy-uuid-1', mockUser);

      expect(strategyRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
      );
    });

    it('should throw NotFoundException when strategy not found', async () => {
      strategyRepository.findOne.mockResolvedValue(null);

      await expect(
        controller.toggle('nonexistent', mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own strategy', async () => {
      strategyRepository.findOne.mockResolvedValue({
        ...mockStrategy,
        user_id: 'other-user-id',
      });

      await expect(
        controller.toggle('strategy-uuid-1', mockUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
