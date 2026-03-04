import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { HealthService } from '../core/monitoring/health.service';

/**
 * 健康检查处理器
 *
 * 定时执行健康检查并发送告警通知。
 * 运行频率：每 5 分钟执行一次。
 *
 * 处理任务：
 * - check-health: 执行全面健康检查
 * - 检测到异常时自动发送告警通知
 *
 * 使用场景：
 * - 系统监控和告警
 * - 主动发现问题
 * - 服务可用性跟踪
 */
@Processor('health-check')
@Injectable()
export class HealthCheckProcessor {
  private readonly logger = new Logger(HealthCheckProcessor.name);

  constructor(private readonly healthService: HealthService) {}

  /**
   * 处理健康检查任务
   *
   * 由定时任务调度，每 5 分钟执行一次。
   * 执行全面的健康检查（数据库、Redis、浏览器会话），
   * 检测到异常时自动发送告警通知。
   *
   * @param job Bull 任务对象
   * @returns 健康状态响应
   */
  @Process('check-health')
  async handleCheckHealth(_job: Job): Promise<any> {
    this.logger.debug('Running health check...');

    try {
      // 执行健康检查
      const health = await this.healthService.checkHealth();

      this.logger.log(
        `Health check completed: status=${health.status}, ` +
          `database=${health.components.database.status}, ` +
          `redis=${health.components.redis.status}, ` +
          `browser=${health.components.browser.status}`,
      );

      // 如果状态异常，发送告警
      if (health.status !== 'up') {
        this.logger.warn('Health check detected issues, sending alert...');
        await this.healthService.sendAlert(health);
      }

      return health;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to run health check: ${errorMessage}`);
      throw error;
    }
  }
}
