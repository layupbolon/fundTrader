import { Injectable, Logger, ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { NotifyService } from '../services/notify/notify.service';

/**
 * 错误上下文接口
 */
interface ErrorContext {
  /** 错误类型 */
  type: string;

  /** 错误消息 */
  message: string;

  /** HTTP 状态码 */
  statusCode: number;

  /** 请求路径 */
  path?: string;

  /** 请求方法 */
  method?: string;

  /** 时间戳 */
  timestamp: string;

  /** 堆栈跟踪 */
  stack?: string;
}

/**
 * 全局错误告警拦截器
 *
 * 捕获未处理的异常，记录详细的错误上下文，并触发告警通知。
 *
 * 功能：
 * - 捕获所有未处理的 HTTP 异常
 * - 记录详细的错误上下文（请求信息、堆栈跟踪等）
 * - 发送告警通知到配置的通知渠道
 * - 返回统一的错误响应格式
 *
 * 错误响应格式：
 * ```json
 * {
 *   "statusCode": 500,
 *   "message": "Internal server error",
 *   "error": "Internal Server Error",
 *   "timestamp": "2026-03-04T12:00:00.000Z",
 *   "path": "/api/strategy"
 * }
 * ```
 *
 * 使用场景：
 * - 全局错误处理
 * - 错误告警通知
 * - 错误日志记录
 *
 * @example
 * // 在 main.ts 中注册
 * app.useGlobalFilters(new ErrorInterceptor(new NotifyService()));
 */
@Injectable()
@Catch()
export class ErrorInterceptor implements ExceptionFilter {
  private readonly logger = new Logger(ErrorInterceptor.name);
  private readonly alertCooldown = 60000; // 60 秒冷却时间，避免告警风暴
  private lastAlertTime = 0;

  constructor(private readonly notifyService?: NotifyService) {}

  /**
   * 捕获并处理异常
   *
   * 当任何未处理的异常发生时，此方法会被调用。
   * 记录错误详情并发送告警通知。
   *
   * @param exception 捕获的异常
   * @param host 参数主机
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 提取错误信息
    const errorContext = this.extractErrorContext(exception, request);

    // 记录错误日志
    this.logger.error(
      `${errorContext.type}: ${errorContext.message} ` +
        `[${errorContext.method} ${errorContext.path}]`,
      errorContext.stack,
    );

    // 发送告警通知（如果有配置通知服务）
    this.sendAlertIfConfigured(errorContext);

    // 返回错误响应
    response.status(errorContext.statusCode).json({
      statusCode: errorContext.statusCode,
      message: errorContext.message,
      error: this.getErrorCodeName(errorContext.statusCode),
      timestamp: errorContext.timestamp,
      path: errorContext.path,
    });
  }

  /**
   * 提取错误上下文
   *
   * 从异常和请求对象中提取详细的错误信息。
   *
   * @param exception 异常对象
   * @param request HTTP 请求对象
   * @returns 错误上下文
   * @private
   */
  private extractErrorContext(exception: unknown, request: Request): ErrorContext {
    const isHttpException =
      exception &&
      typeof exception === 'object' &&
      'getStatus' in exception &&
      'getResponse' in exception;

    const statusCode = isHttpException
      ? (exception as any).getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = isHttpException
      ? this.extractMessage((exception as any).getResponse())
      : 'Internal server error';

    const type = isHttpException ? 'HttpException' : exception?.constructor?.name || 'Error';

    return {
      type,
      message,
      statusCode,
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      stack: exception instanceof Error ? exception.stack : undefined,
    };
  }

  /**
   * 提取错误消息
   *
   * 从 HTTP 异常响应中提取用户友好的错误消息。
   *
   * @param response HTTP 异常响应
   * @returns 错误消息
   * @private
   */
  private extractMessage(response: any): string {
    if (typeof response === 'string') {
      return response;
    }
    if (response && typeof response === 'object' && response.message) {
      if (Array.isArray(response.message)) {
        return response.message.join('; ');
      }
      return response.message;
    }
    return 'Internal server error';
  }

  /**
   * 获取状态码对应的错误名称
   *
   * @param statusCode HTTP 状态码
   * @returns 错误名称
   * @private
   */
  private getErrorCodeName(statusCode: number): string {
    const statusMap: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'Bad Request',
      [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
      [HttpStatus.FORBIDDEN]: 'Forbidden',
      [HttpStatus.NOT_FOUND]: 'Not Found',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
      [HttpStatus.BAD_GATEWAY]: 'Bad Gateway',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
      [HttpStatus.GATEWAY_TIMEOUT]: 'Gateway Timeout',
    };
    return statusMap[statusCode] || 'Error';
  }

  /**
   * 发送告警通知（如果配置了通知服务）
   *
   * 使用冷却机制避免告警风暴：相同错误在 60 秒内只发送一次。
   *
   * @param errorContext 错误上下文
   * @private
   */
  private async sendAlertIfConfigured(errorContext: ErrorContext): Promise<void> {
    if (!this.notifyService) {
      return;
    }

    const now = Date.now();

    // 冷却机制：避免短时间内发送大量告警
    if (now - this.lastAlertTime < this.alertCooldown) {
      this.logger.debug('Alert cooldown active, skipping notification');
      return;
    }

    this.lastAlertTime = now;

    const alertMessage: Parameters<typeof this.notifyService.send>[0] = {
      title: 'API 错误告警',
      content:
        `错误类型：${errorContext.type}\n` +
        `错误消息：${errorContext.message}\n` +
        `请求路径：${errorContext.method} ${errorContext.path}\n` +
        `状态码：${errorContext.statusCode}\n` +
        `时间：${errorContext.timestamp}`,
      level: 'error',
    };

    try {
      await this.notifyService.send(alertMessage);
      this.logger.log('Error alert notification sent');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send error alert: ${errorMessage}`);
    }
  }
}
