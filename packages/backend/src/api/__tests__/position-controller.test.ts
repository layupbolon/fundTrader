import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Position } from '../../models';
import { PositionController } from '../controllers';

describe('PositionController', () => {
  let controller: PositionController;
  let positionRepository: {
    findOne: ReturnType<typeof vi.fn>;
    findAndCount: ReturnType<typeof vi.fn>;
  };

  const mockUser = { id: 'user-uuid-1', username: 'testuser' };
  const mockPosition = {
    id: 'position-uuid-1',
    user_id: 'user-uuid-1',
    fund_code: '110011',
    shares: 100,
    avg_price: 1.2,
    current_value: 120,
  };

  beforeEach(async () => {
    positionRepository = {
      findOne: vi.fn(),
      findAndCount: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PositionController],
      providers: [
        {
          provide: getRepositoryToken(Position),
          useValue: positionRepository,
        },
      ],
    }).compile();

    controller = module.get<PositionController>(PositionController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return paginated positions for current user', async () => {
    positionRepository.findAndCount.mockResolvedValue([[mockPosition], 1]);

    const result = await controller.findAll({ page: 1, limit: 20 }, mockUser);

    expect(result.data).toHaveLength(1);
    expect(positionRepository.findAndCount).toHaveBeenCalledWith({
      where: { user_id: 'user-uuid-1' },
      relations: ['fund', 'user'],
      skip: 0,
      take: 20,
      order: { updated_at: 'DESC' },
    });
  });

  it('should query position detail within current user scope', async () => {
    positionRepository.findOne.mockResolvedValue(mockPosition);

    const result = await controller.findOne('position-uuid-1', mockUser);

    expect(result).toEqual(mockPosition);
    expect(positionRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'position-uuid-1', user_id: 'user-uuid-1' },
      relations: ['fund'],
    });
  });
});
