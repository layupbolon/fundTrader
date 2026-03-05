import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { OperationLogService } from '../core/logger/operation-log.service';

/**
 * 日志清理处理器
 *
 * 定期清理过期的操作日志，保留最近 30 天的日志记录。
 *
 * 清理策略：
 * - 保留最近 30 天的所有日志
 * - 30 天前的日志自动删除
 * - 每周日凌晨 3 点执行
 */
@Processor('log-cleanup')
@Injectable()
export class LogCleanupProcessor {
  private readonly logger = new Logger(LogCleanupProcessor.name);

  constructor(private readonly logService: OperationLogService) {}

  /**
   * 执行日志清理任务
   *
   * 删除 30 天前的操作日志
   */
  @Process('cleanup-old-logs')
  async handleCleanup(job: Job) {
    this.logger.log('Starting log cleanup job...');

    try {
      // 计算 30 天前的日期
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // 执行清理
      const deletedCount = await this.logService.cleanup(thirtyDaysAgo);

      this.logger.log(`Log cleanup completed. Deleted ${deletedCount} old log records.`);

      // 记录清理操作到日志
      await this.logService.logSystemAction(
        'SYSTEM_OPERATION' as any,
        'system',
        `日志清理任务执行成功，删除 ${deletedCount} 条过期日志`,
        {
          cleanupDate: thirtyDaysAgo.toISOString(),
          deletedCount,
          jobId: job.id,
        },
      );

      return {
        success: true,
        deletedCount,
        cleanupDate: thirtyDaysAgo.toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Log cleanup failed: ${errorMessage}`);

      // 记录失败日志
      await this.logService.logFailure(
        'SYSTEM_OPERATION' as any,
        'system',
        '日志清理任务执行失败',
        errorMessage,
      );

      throw error;
    }
  }
}
