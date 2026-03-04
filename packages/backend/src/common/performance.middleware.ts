import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * 性能指标采集中间件
 *
 * 记录每个请求的处理时间，并在响应头中添加 X-Response-Time。
 *
 * 功能：
 * - 记录请求开始时间
 * - 计算请求处理耗时
 * - 在响应头中添加 X-Response-Time: XXXms
 * - 记录慢请求日志（超过 1 秒）
 *
 * 响应头格式：
 * ```
 * X-Response-Time: 125ms
 * ```
 *
 * 使用场景：
 * - API 性能监控
 * - 慢请求检测
 * - 响应时间统计
 *
 * @example
 * // 在 main.ts 中注册
 * app.use(new PerformanceMiddleware());
 *
 * @example
 * // 响应头示例
 * HTTP/1.1 200 OK
 * X-Response-Time: 125ms
 */
@Injectable()
export class PerformanceMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PerformanceMiddleware.name);
  private readonly slowRequestThreshold = 1000; // 1 秒

  /**
   * 中间件执行函数
   *
   * 拦截每个 HTTP 请求，记录处理时间并在响应头中添加耗时。
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

      // 设置响应头
      response.setHeader('X-Response-Time', `${responseTime}ms`);

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
