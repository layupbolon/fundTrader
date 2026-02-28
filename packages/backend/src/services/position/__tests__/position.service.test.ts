import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PositionService } from '../position.service';
import { Position, FundNav } from '../../../models';

describe('PositionService', () => {
  let service: PositionService;
  let positionRepository: any;
  let fundNavRepository: any;

  beforeEach(async () => {
    positionRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    fundNavRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PositionService,
        {
          provide: getRepositoryToken(Position),
          useValue: positionRepository,
        },
        {
          provide: getRepositoryToken(FundNav),
          useValue: fundNavRepository,
        },
      ],
    }).compile();

    service = module.get<PositionService>(PositionService);
  });

  describe('updatePositionOnBuy', () => {
    it('should increase shares and cost on buy confirmation', async () => {
      const existingPosition = {
        id: 'pos1',
        user_id: 'user1',
        fund_code: '000001',
        shares: 1000,
        cost: 1500,
        avg_price: 1.5,
        current_value: 1600,
        profit: 100,
        profit_rate: 0.0667,
        max_profit_rate: 0.1,
      };

      positionRepository.findOne.mockResolvedValue(existingPosition);
      positionRepository.save.mockImplementation((pos: any) => Promise.resolve(pos));

      await service.updatePositionOnBuy('user1', '000001', 500, 2.0);

      expect(positionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          shares: 1500, // 1000 + 500
          cost: 2500, // 1500 + 500*2.0
          avg_price: 2500 / 1500, // weighted average
        }),
      );
    });

    it('should calculate correct weighted average price', async () => {
      const existingPosition = {
        id: 'pos1',
        user_id: 'user1',
        fund_code: '000001',
        shares: 1000,
        cost: 1000,
        avg_price: 1.0,
        current_value: 1000,
        profit: 0,
        profit_rate: 0,
        max_profit_rate: 0,
      };

      positionRepository.findOne.mockResolvedValue(existingPosition);
      positionRepository.save.mockImplementation((pos: any) => Promise.resolve(pos));

      await service.updatePositionOnBuy('user1', '000001', 1000, 2.0);

      // New cost = 1000 + 2000 = 3000, new shares = 2000
      // avg_price = 3000/2000 = 1.5
      expect(positionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          shares: 2000,
          cost: 3000,
          avg_price: 1.5,
        }),
      );
    });

    it('should create position if not exists', async () => {
      positionRepository.findOne.mockResolvedValue(null);
      positionRepository.create.mockReturnValue({
        user_id: 'user1',
        fund_code: '000001',
        shares: 0,
        cost: 0,
        avg_price: 0,
        current_value: 0,
        profit: 0,
        profit_rate: 0,
        max_profit_rate: 0,
      });
      positionRepository.save.mockImplementation((pos: any) => Promise.resolve(pos));

      await service.updatePositionOnBuy('user1', '000001', 500, 2.0);

      expect(positionRepository.create).toHaveBeenCalled();
      expect(positionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          shares: 500,
          cost: 1000, // 500 * 2.0
          avg_price: 2.0,
        }),
      );
    });
  });

  describe('updatePositionOnSell', () => {
    it('should decrease shares and cost on sell confirmation', async () => {
      const existingPosition = {
        id: 'pos1',
        user_id: 'user1',
        fund_code: '000001',
        shares: 1000,
        cost: 1500,
        avg_price: 1.5,
        current_value: 1800,
        profit: 300,
        profit_rate: 0.2,
        max_profit_rate: 0.2,
      };

      positionRepository.findOne.mockResolvedValue(existingPosition);
      positionRepository.save.mockImplementation((pos: any) => Promise.resolve(pos));

      await service.updatePositionOnSell('user1', '000001', 400, 1.8);

      // sellCost = 400 * 1.5 = 600
      // newShares = 1000 - 400 = 600
      // newCost = 1500 - 600 = 900
      // avg_price = 900 / 600 = 1.5
      expect(positionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          shares: 600,
          cost: 900,
          avg_price: 1.5, // avg_price should remain the same
        }),
      );
    });

    it('should set all to zero when selling all shares', async () => {
      const existingPosition = {
        id: 'pos1',
        user_id: 'user1',
        fund_code: '000001',
        shares: 1000,
        cost: 1500,
        avg_price: 1.5,
        current_value: 1800,
        profit: 300,
        profit_rate: 0.2,
        max_profit_rate: 0.2,
      };

      positionRepository.findOne.mockResolvedValue(existingPosition);
      positionRepository.save.mockImplementation((pos: any) => Promise.resolve(pos));

      await service.updatePositionOnSell('user1', '000001', 1000, 1.8);

      expect(positionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          shares: 0,
          cost: 0,
          avg_price: 0,
        }),
      );
    });

    it('should throw error if position not found', async () => {
      positionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updatePositionOnSell('user1', '000001', 500, 1.8),
      ).rejects.toThrow('Position not found');
    });
  });

  describe('refreshAllPositionValues', () => {
    it('should update current_value, profit, and profit_rate using latest NAV', async () => {
      const position = {
        id: 'pos1',
        user_id: 'user1',
        fund_code: '000001',
        shares: 1000,
        cost: 1500,
        avg_price: 1.5,
        current_value: 0,
        profit: 0,
        profit_rate: 0,
        max_profit_rate: 0,
      };

      positionRepository.find.mockResolvedValue([position]);
      fundNavRepository.findOne.mockResolvedValue({ nav: 1.8 });
      positionRepository.save.mockImplementation((pos: any) => Promise.resolve(pos));

      await service.refreshAllPositionValues();

      // current_value = 1000 * 1.8 = 1800
      // profit = 1800 - 1500 = 300
      // profit_rate = 300 / 1500 = 0.2
      expect(positionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          current_value: 1800,
          profit: 300,
          profit_rate: 0.2,
          max_profit_rate: 0.2, // Updated since 0.2 > 0
        }),
      );
    });

    it('should update max_profit_rate when current profit_rate exceeds it', async () => {
      const position = {
        id: 'pos1',
        user_id: 'user1',
        fund_code: '000001',
        shares: 1000,
        cost: 1000,
        avg_price: 1.0,
        current_value: 0,
        profit: 0,
        profit_rate: 0,
        max_profit_rate: 0.15, // Previous max was 15%
      };

      positionRepository.find.mockResolvedValue([position]);
      fundNavRepository.findOne.mockResolvedValue({ nav: 1.25 }); // 25% profit
      positionRepository.save.mockImplementation((pos: any) => Promise.resolve(pos));

      await service.refreshAllPositionValues();

      expect(positionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          profit_rate: 0.25,
          max_profit_rate: 0.25, // Updated to 25%
        }),
      );
    });

    it('should NOT decrease max_profit_rate when current is lower', async () => {
      const position = {
        id: 'pos1',
        user_id: 'user1',
        fund_code: '000001',
        shares: 1000,
        cost: 1000,
        avg_price: 1.0,
        current_value: 0,
        profit: 0,
        profit_rate: 0,
        max_profit_rate: 0.25, // Previous max was 25%
      };

      positionRepository.find.mockResolvedValue([position]);
      fundNavRepository.findOne.mockResolvedValue({ nav: 1.1 }); // Only 10% profit now
      positionRepository.save.mockImplementation((pos: any) => Promise.resolve(pos));

      await service.refreshAllPositionValues();

      expect(positionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          profit_rate: expect.closeTo(0.1, 5),
          max_profit_rate: 0.25, // Stays at 25%
        }),
      );
    });

    it('should skip positions without latest NAV', async () => {
      const position = {
        id: 'pos1',
        user_id: 'user1',
        fund_code: '000001',
        shares: 1000,
        cost: 1500,
        avg_price: 1.5,
        current_value: 0,
        profit: 0,
        profit_rate: 0,
        max_profit_rate: 0,
      };

      positionRepository.find.mockResolvedValue([position]);
      fundNavRepository.findOne.mockResolvedValue(null);

      await service.refreshAllPositionValues();

      expect(positionRepository.save).not.toHaveBeenCalled();
    });

    it('should handle multiple positions', async () => {
      const positions = [
        {
          id: 'pos1',
          fund_code: '000001',
          shares: 1000,
          cost: 1000,
          max_profit_rate: 0,
        },
        {
          id: 'pos2',
          fund_code: '000002',
          shares: 500,
          cost: 750,
          max_profit_rate: 0,
        },
      ];

      positionRepository.find.mockResolvedValue(positions);
      fundNavRepository.findOne
        .mockResolvedValueOnce({ nav: 1.1 })  // fund 000001
        .mockResolvedValueOnce({ nav: 1.6 }); // fund 000002
      positionRepository.save.mockImplementation((pos: any) => Promise.resolve(pos));

      await service.refreshAllPositionValues();

      expect(positionRepository.save).toHaveBeenCalledTimes(2);
    });
  });
});
