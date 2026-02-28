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
    // 工作日 20:00 主同步（基金净值通常在 18:00-20:00 间发布）
    this.dataSyncQueue.add(
      'sync-nav',
      {},
      {
        repeat: { cron: '0 20 * * 1-5' },
        removeOnComplete: true,
      },
    );

    // 工作日 22:00 补充重试（部分基金净值发布较晚）
    this.dataSyncQueue.add(
      'sync-nav',
      {},
      {
        repeat: { cron: '0 22 * * 1-5' },
        removeOnComplete: true,
      },
    );

    // 工作日 09:00 兜底同步（确保最新数据可用）
    this.dataSyncQueue.add(
      'sync-nav',
      {},
      {
        repeat: { cron: '0 9 * * 1-5' },
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

    // 每天 21:00 确认待处理交易（T+1 确认）
    this.tradingQueue.add(
      'confirm-pending-transactions',
      {},
      {
        repeat: { cron: '0 21 * * 1-5' },
        removeOnComplete: true,
      },
    );

    // 每天 21:30 刷新持仓市值（工作日，净值更新后）
    this.tradingQueue.add(
      'refresh-position-values',
      {},
      {
        repeat: { cron: '30 21 * * 1-5' },
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

    // 工作日每小时检查网格交易
    this.tradingQueue.add(
      'check-grid-trading',
      {},
      {
        repeat: { cron: '0 * * * 1-5' },
        removeOnComplete: true,
      },
    );

    // 工作日 14:00 检查再平衡
    this.tradingQueue.add(
      'check-rebalance',
      {},
      {
        repeat: { cron: '0 14 * * 1-5' },
        removeOnComplete: true,
      },
    );

    console.log('Scheduled jobs initialized');
  }
}
