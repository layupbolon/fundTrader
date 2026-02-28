import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { SchedulerService } from '../scheduler.service';

describe('SchedulerService', () => {
  let service: SchedulerService;
  let tradingQueue: any;
  let dataSyncQueue: any;

  beforeEach(async () => {
    tradingQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    };

    dataSyncQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: getQueueToken('trading'), useValue: tradingQueue },
        { provide: getQueueToken('data-sync'), useValue: dataSyncQueue },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
  });

  describe('onModuleInit', () => {
    it('should set up all scheduled jobs', () => {
      service.onModuleInit();

      // data-sync queue should have nav sync jobs
      expect(dataSyncQueue.add).toHaveBeenCalledWith(
        'sync-nav',
        {},
        expect.objectContaining({ removeOnComplete: true }),
      );

      // trading queue should have multiple job types
      expect(tradingQueue.add).toHaveBeenCalledWith(
        'check-auto-invest',
        {},
        expect.objectContaining({ removeOnComplete: true }),
      );

      expect(tradingQueue.add).toHaveBeenCalledWith(
        'check-take-profit-stop-loss',
        {},
        expect.objectContaining({ removeOnComplete: true }),
      );

      expect(tradingQueue.add).toHaveBeenCalledWith(
        'keep-session-alive',
        {},
        expect.objectContaining({ removeOnComplete: true }),
      );
    });

    it('should set up nav sync with correct cron expressions', () => {
      service.onModuleInit();

      const navSyncCalls = dataSyncQueue.add.mock.calls.filter(
        (call: any[]) => call[0] === 'sync-nav',
      );

      // 3 sync-nav schedules: 20:00, 22:00, 09:00
      expect(navSyncCalls).toHaveLength(3);
      navSyncCalls.forEach((call: any[]) => {
        expect(call[2]).toHaveProperty('repeat');
        expect(call[2]).toHaveProperty('removeOnComplete', true);
      });
    });

    it('should set up auto-invest with workday cron', () => {
      service.onModuleInit();

      const autoInvestCall = tradingQueue.add.mock.calls.find(
        (call: any[]) => call[0] === 'check-auto-invest',
      );

      expect(autoInvestCall[2].repeat.cron).toBe('30 14 * * 1-5');
    });

    it('should set up grid trading with hourly workday cron', () => {
      service.onModuleInit();

      const gridCall = tradingQueue.add.mock.calls.find(
        (call: any[]) => call[0] === 'check-grid-trading',
      );

      expect(gridCall).toBeDefined();
      expect(gridCall[2].repeat.cron).toBe('0 * * * 1-5');
      expect(gridCall[2].removeOnComplete).toBe(true);
    });

    it('should set up rebalance with workday 14:00 cron', () => {
      service.onModuleInit();

      const rebalanceCall = tradingQueue.add.mock.calls.find(
        (call: any[]) => call[0] === 'check-rebalance',
      );

      expect(rebalanceCall).toBeDefined();
      expect(rebalanceCall[2].repeat.cron).toBe('0 14 * * 1-5');
      expect(rebalanceCall[2].removeOnComplete).toBe(true);
    });

    it('should set removeOnComplete on all jobs', () => {
      service.onModuleInit();

      const allCalls = [...tradingQueue.add.mock.calls, ...dataSyncQueue.add.mock.calls];
      allCalls.forEach((call) => {
        expect(call[2].removeOnComplete).toBe(true);
      });
    });

    it('should set up confirm-pending-transactions job', () => {
      service.onModuleInit();

      const confirmCall = tradingQueue.add.mock.calls.find(
        (call: any[]) => call[0] === 'confirm-pending-transactions',
      );

      expect(confirmCall).toBeDefined();
      expect(confirmCall[2].repeat.cron).toBe('0 21 * * 1-5');
    });

    it('should set up refresh-position-values job', () => {
      service.onModuleInit();

      const refreshCall = tradingQueue.add.mock.calls.find(
        (call: any[]) => call[0] === 'refresh-position-values',
      );

      expect(refreshCall).toBeDefined();
      expect(refreshCall[2].repeat.cron).toBe('30 21 * * 1-5');
    });
  });
});
