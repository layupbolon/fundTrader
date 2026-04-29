import { Test, TestingModule } from '@nestjs/testing';
import { DataSyncProcessor } from '../data-sync.processor';
import { FundDataService } from '../../services/data/fund-data.service';

describe('DataSyncProcessor', () => {
  let processor: DataSyncProcessor;
  let fundDataService: jest.Mocked<FundDataService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataSyncProcessor,
        {
          provide: FundDataService,
          useValue: {
            syncAllFundNav: vi.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<DataSyncProcessor>(DataSyncProcessor);
    fundDataService = module.get(FundDataService);
  });

  describe('handleSyncNav', () => {
    it('should call syncAllFundNav', async () => {
      fundDataService.syncAllFundNav.mockResolvedValue(undefined);

      await processor.handleSyncNav({} as any);

      expect(fundDataService.syncAllFundNav).toHaveBeenCalledTimes(1);
    });

    it('should handle and log errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      fundDataService.syncAllFundNav.mockRejectedValue(new Error('sync failed'));

      await processor.handleSyncNav({} as any);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to sync fund NAV:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should complete successfully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      fundDataService.syncAllFundNav.mockResolvedValue(undefined);

      await processor.handleSyncNav({} as any);

      expect(consoleSpy).toHaveBeenCalledWith('Fund NAV sync completed');
      consoleSpy.mockRestore();
    });

    it('should log start message', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      fundDataService.syncAllFundNav.mockResolvedValue(undefined);

      await processor.handleSyncNav({} as any);

      expect(consoleSpy).toHaveBeenCalledWith('Syncing fund NAV data...');
      consoleSpy.mockRestore();
    });
  });
});
