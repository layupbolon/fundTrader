import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * 性能指标采集中间件
 *
 * 记录每个请求的处理时间。
 *
 * 功能：
 * - 记录请求开始时间
 * - 计算请求处理耗时
 * - 记录慢请求日志（超过 1 秒）
 *
 * 使用场景：
 * - API 性能监控
 * - 慢请求检测
 * - 响应时间统计（配合 LoggingInterceptor 输出响应头）
 *
 * @example
 * // 在 main.ts 中注册
 * app.use(new PerformanceMiddleware());
 *
 */
@Injectable()
export class PerformanceMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PerformanceMiddleware.name);
  private readonly slowRequestThreshold = 1000; // 1 秒

  /**
   * 中间件执行函数
   *
   * 拦截每个 HTTP 请求，记录处理时间并输出慢请求日志。
   *
   * @param request HTTP 请求对象
   * @param response HTTP 响应对象
   * @param next 下一个中间件
   */
  use(request: Request, response: Response, next: NextFunction): void {
    const startTime = Date.now();

    // 在响应完成后记录日志
    response.on('finish', () => {
      const responseTime = Date.now() - startTime;

      // 记录慢请求
      if (responseTime > this.slowRequestThreshold) {
        this.logger.warn(
          `Slow request: ${request.method} ${request.originalUrl} - ` +
            `${responseTime}ms - status: ${response.statusCode}`,
        );
      }
    });

    next();
  }
}
