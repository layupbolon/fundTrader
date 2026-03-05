import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

/**
 * 日志拦截器
 *
 * 自动记录所有 HTTP 请求的详细信息，包括：
 * - 请求方法、路径、参数
 * - 响应状态码
 * - 执行时长
 * - IP 地址
 * - User-Agent
 *
 * 使用场景：
 * - API 访问日志
 * - 性能监控
 * - 问题排查
 *
 * @example
 * // 在模块中使用
 * @UseInterceptors(LoggingInterceptor)
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const startTime = Date.now();
    const { method, url, headers } = request;

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        // 构建日志消息
        const logMessage = `${method} ${url} ${statusCode} - ${duration}ms`;

        // 记录日志
        this.logger.log(logMessage, {
          method,
          url,
          statusCode,
          durationMs: duration,
          userAgent: headers['user-agent'],
          ip: this.getClientIp(request),
        });

        // 添加响应头 - 性能指标
        response.setHeader('X-Response-Time', `${duration}ms`);
      }),
    );
  }

  /**
   * 获取客户端真实 IP 地址
   *
   * 考虑代理情况（如 nginx、CDN）
   *
   * @param request HTTP 请求对象
   * @returns 客户端 IP 地址
   * @private
   */
  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'] as string;

    if (forwarded) {
      // x-forwarded-for 可能包含多个 IP，取第一个
      return forwarded.split(',')[0].trim();
    }

    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}
