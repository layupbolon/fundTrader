import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService, HealthStatusResponse } from './health.service';

/**
 * 健康检查控制器
 *
 * 提供系统健康检查的 REST API 端点。
 *
 * 端点：
 * - GET /health - 返回所有组件的健康状态
 *
 * 响应格式：
 * ```json
 * {
 *   "status": "up",
 *   "components": {
 *     "database": {
 *       "name": "database",
 *       "status": "up",
 *       "message": "Database connection healthy",
 *       "responseTime": 5
 *     },
 *     "redis": {
 *       "name": "redis",
 *       "status": "up",
 *       "message": "Redis connection healthy",
 *       "responseTime": 2
 *     },
 *     "browser": {
 *       "name": "browser",
 *       "status": "up",
 *       "message": "Browser session is active and valid"
 *     }
 *   },
 *   "timestamp": "2026-03-04T12:00:00.000Z"
 * }
 * ```
 *
 * 状态说明：
 * - up: 所有组件正常
 * - degraded: 部分组件降级（如浏览器会话过期）
 * - down: 有关键组件不可用
 *
 * @see HealthService - 执行实际的健康检查逻辑
 */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * 健康检查端点
   *
   * 返回系统所有组件的健康状态，包括数据库、Redis 和浏览器会话。
   *
   * @returns 健康状态响应
   *
   * @example
   * GET /health
   *
   * @example
   * Response:
   * {
   *   "status": "up",
   *   "components": {
   *     "database": { "name": "database", "status": "up", ... },
   *     "redis": { "name": "redis", "status": "up", ... },
   *     "browser": { "name": "browser", "status": "up", ... }
   *   },
   *   "timestamp": "2026-03-04T12:00:00.000Z"
   * }
   */
  @Get()
  @ApiTags('监控')
  @ApiOperation({
    summary: '健康检查',
    description: '检查系统各组件（数据库、Redis、浏览器会话）的健康状态',
  })
  @ApiResponse({
    status: 200,
    description: '健康检查成功',
    type: Object,
    example: {
      status: 'up',
      components: {
        database: {
          name: 'database',
          status: 'up',
          message: 'Database connection healthy',
          responseTime: 5,
        },
        redis: {
          name: 'redis',
          status: 'up',
          message: 'Redis connection healthy',
          responseTime: 2,
        },
        browser: {
          name: 'browser',
          status: 'up',
          message: 'Browser session is active and valid',
        },
      },
      timestamp: '2026-03-04T12:00:00.000Z',
    },
  })
  @ApiResponse({ status: 503, description: '服务不可用' })
  async checkHealth(): Promise<HealthStatusResponse> {
    return this.healthService.checkHealth();
  }
}
