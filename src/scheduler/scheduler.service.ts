import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class SchedulerService implements OnModuleInit {
  constructor(
    @InjectQueue('trading') private tradingQueue: Queue,
    @InjectQueue('data-sync') private dataSyncQueue: Queue,
  ) {}

  onModuleInit() {
    this.setupScheduledJobs();
  }

  private setupScheduledJobs() {
    // 每天早上9:00同步基金净值
    this.dataSyncQueue.add(
      'sync-nav',
      {},
      {
        repeat: { cron: '0 9 * * *' },
        removeOnComplete: true,
      },
    );

    // 每天14:30检查定投策略（工作日）
    this.tradingQueue.add(
      'check-auto-invest',
      {},
      {
        repeat: { cron: '30 14 * * 1-5' },
        removeOnComplete: true,
      },
    );

    // 每小时检查止盈止损
    this.tradingQueue.add(
      'check-take-profit-stop-loss',
      {},
      {
        repeat: { cron: '0 * * * *' },
        removeOnComplete: true,
      },
    );

    // 每30分钟保持会话活跃
    this.tradingQueue.add(
      'keep-session-alive',
      {},
      {
        repeat: { cron: '*/30 * * * *' },
        removeOnComplete: true,
      },
    );

    console.log('Scheduled jobs initialized');
  }
}
