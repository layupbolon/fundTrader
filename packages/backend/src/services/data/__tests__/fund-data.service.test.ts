import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FundDataService } from '../fund-data.service';
import { Fund, FundNav } from '../../../models';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FundDataService', () => {
  let service: FundDataService;
  let fundRepository: jest.Mocked<Repository<Fund>>;
  let fundNavRepository: jest.Mocked<Repository<FundNav>>;

  beforeEach(async () => {
    const mockFundRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const mockFundNavRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FundDataService,
        {
          provide: getRepositoryToken(Fund),
          useValue: mockFundRepository,
        },
        {
          provide: getRepositoryToken(FundNav),
          useValue: mockFundNavRepository,
        },
      ],
    }).compile();

    service = module.get<FundDataService>(FundDataService);
    fundRepository = module.get(getRepositoryToken(Fund));
    fundNavRepository = module.get(getRepositoryToken(FundNav));

    jest.clearAllMocks();
  });

  describe('getFundInfo', () => {
    it('should return existing fund from database', async () => {
      const mockFund = {
        code: '000001',
        name: '华夏成长',
        type: '混合型',
        manager: '张三',
      } as Fund;

      fundRepository.findOne.mockResolvedValue(mockFund);

      const result = await service.getFundInfo('000001');

      expect(result).toEqual(mockFund);
      expect(fundRepository.findOne).toHaveBeenCalledWith({ where: { code: '000001' } });
      expect(fundRepository.create).not.toHaveBeenCalled();
    });

    it('should fetch and save new fund if not in database', async () => {
      const mockFund = {
        code: '000001',
        name: '基金000001',
        type: '混合型',
        manager: '未知',
      } as Fund;

      fundRepository.findOne.mockResolvedValue(null);
      fundRepository.create.mockReturnValue(mockFund);
      fundRepository.save.mockResolvedValue(mockFund);
      mockedAxios.get.mockResolvedValue({ data: '<html></html>' });

      const result = await service.getFundInfo('000001');

      expect(fundRepository.findOne).toHaveBeenCalled();
      expect(fundRepository.create).toHaveBeenCalledWith({
        code: '000001',
        name: '基金000001',
        type: '混合型',
        manager: '未知',
      });
      expect(fundRepository.save).toHaveBeenCalledWith(mockFund);
      expect(result).toEqual(mockFund);
    });

    it('should handle API fetch error gracefully', async () => {
      fundRepository.findOne.mockResolvedValue(null);
      fundRepository.create.mockReturnValue({} as Fund);
      fundRepository.save.mockResolvedValue({} as Fund);
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const result = await service.getFundInfo('000001');

      expect(result).toBeDefined();
      expect(fundRepository.save).toHaveBeenCalled();
    });
  });

  describe('getFundNav', () => {
    it('should return existing nav from database', async () => {
      const mockNav = {
        fund_code: '000001',
        nav: 1.5,
        acc_nav: 2.0,
        date: new Date('2026-02-25'),
        growth_rate: 0.02,
      } as FundNav;

      fundNavRepository.findOne.mockResolvedValue(mockNav);

      const result = await service.getFundNav('000001', new Date('2026-02-25'));

      expect(result).toEqual(mockNav);
      expect(fundNavRepository.findOne).toHaveBeenCalled();
      expect(fundNavRepository.create).not.toHaveBeenCalled();
    });

    it('should fetch and save new nav if not in database', async () => {
      const mockNav = {
        fund_code: '000001',
        nav: 1.5,
        acc_nav: 2.0,
        date: new Date('2026-02-25'),
        growth_rate: 0.02,
      } as FundNav;

      fundNavRepository.findOne.mockResolvedValue(null);
      fundNavRepository.create.mockReturnValue(mockNav);
      fundNavRepository.save.mockResolvedValue(mockNav);
      mockedAxios.get.mockResolvedValue({
        data: 'jsonpgz({"dwjz":"1.5","ljjz":"2.0","gztime":"2026-02-25","gszzl":"0.02"})',
      });

      const result = await service.getFundNav('000001', new Date('2026-02-25'));

      expect(fundNavRepository.create).toHaveBeenCalled();
      expect(fundNavRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockNav);
    });

    it('should use current date if no date provided', async () => {
      fundNavRepository.findOne.mockResolvedValue(null);
      mockedAxios.get.mockResolvedValue({
        data: 'jsonpgz({"gsz":"1.5","gztime":"2026-02-25"})',
      });
      fundNavRepository.create.mockReturnValue({} as FundNav);
      fundNavRepository.save.mockResolvedValue({} as FundNav);

      await service.getFundNav('000001');

      expect(fundNavRepository.findOne).toHaveBeenCalled();
    });

    it('should return null if API fetch fails', async () => {
      fundNavRepository.findOne.mockResolvedValue(null);
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const result = await service.getFundNav('000001');

      expect(result).toBeNull();
    });

    it('should handle invalid JSONP response', async () => {
      fundNavRepository.findOne.mockResolvedValue(null);
      mockedAxios.get.mockResolvedValue({ data: 'invalid data' });

      const result = await service.getFundNav('000001');

      expect(result).toBeNull();
    });
  });

  describe('getHistoricalNav', () => {
    it('should return navs within date range', async () => {
      const mockNavs = [
        { fund_code: '000001', date: new Date('2026-01-01'), nav: 1.0 } as FundNav,
        { fund_code: '000001', date: new Date('2026-01-15'), nav: 1.1 } as FundNav,
        { fund_code: '000001', date: new Date('2026-02-01'), nav: 1.2 } as FundNav,
        { fund_code: '000001', date: new Date('2026-02-15'), nav: 1.3 } as FundNav,
        { fund_code: '000001', date: new Date('2026-03-01'), nav: 1.4 } as FundNav,
      ];

      fundNavRepository.find.mockResolvedValue(mockNavs);

      const result = await service.getHistoricalNav(
        '000001',
        new Date('2026-01-10'),
        new Date('2026-02-20'),
      );

      expect(result).toHaveLength(3); // Only dates between 01-10 and 02-20
      expect(result[0].date).toEqual(new Date('2026-01-15'));
      expect(result[2].date).toEqual(new Date('2026-02-15'));
    });

    it('should return empty array if no navs in range', async () => {
      fundNavRepository.find.mockResolvedValue([]);

      const result = await service.getHistoricalNav(
        '000001',
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      expect(result).toEqual([]);
    });
  });

  describe('syncAllFundNav', () => {
    it('should sync nav for all funds', async () => {
      const mockFunds = [
        { code: '000001', name: 'Fund 1' } as Fund,
        { code: '000002', name: 'Fund 2' } as Fund,
      ];

      fundRepository.find.mockResolvedValue(mockFunds);
      fundNavRepository.findOne.mockResolvedValue({} as FundNav);

      await service.syncAllFundNav();

      expect(fundRepository.find).toHaveBeenCalled();
      expect(fundNavRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('should continue on individual fund sync failure', async () => {
      const mockFunds = [
        { code: '000001', name: 'Fund 1' } as Fund,
        { code: '000002', name: 'Fund 2' } as Fund,
      ];

      fundRepository.find.mockResolvedValue(mockFunds);
      fundNavRepository.findOne
        .mockRejectedValueOnce(new Error('Sync failed'))
        .mockResolvedValueOnce({} as FundNav);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await service.syncAllFundNav();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to sync nav for fund 000001'),
        expect.any(Error),
      );
      expect(fundNavRepository.findOne).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });

    it('should handle empty fund list', async () => {
      fundRepository.find.mockResolvedValue([]);

      await service.syncAllFundNav();

      expect(fundRepository.find).toHaveBeenCalled();
      expect(fundNavRepository.findOne).not.toHaveBeenCalled();
    });
  });
});
