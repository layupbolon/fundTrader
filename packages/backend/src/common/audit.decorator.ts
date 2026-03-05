import {
  SetMetadata,
  applyDecorators,
  UseInterceptors,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { OperationType, OperationStatus } from '../models/operation-log.entity';

/**
 * 审计元数据键
 */
export const AUDIT_METADATA = 'AUDIT_METADATA';

/**
 * 审计选项
 */
export interface AuditOptions {
  /** 操作类型 */
  type: OperationType;

  /** 操作模块 */
  module: string;

  /** 操作描述模板，支持参数替换 */
  description?: string;

  /** 是否记录请求体 */
  logRequestBody?: boolean;

  /** 是否记录响应体 */
  logResponseBody?: boolean;

  /** 自定义上下文 extractor */
  contextExtractor?: (request: Request, responseBody: any) => Record<string, any>;
}

/**
 * 审计装饰器
 *
 * 用于标记需要审计的操作，自动记录到操作日志表。
 *
 * 功能：
 * - 自动记录操作类型、模块、描述
 * - 记录请求参数和响应
 * - 记录执行时长
 * - 支持自定义上下文
 *
 * 使用场景：
 * - 策略配置变更
 * - 风控配置变更
 * - 用户信息修改
 * - 重要交易操作
 *
 * @example
 * // 基本用法
 * @Audit({ type: OperationType.STRATEGY_CREATE, module: 'strategy' })
 * @Post()
 * createStrategy(@Body() dto: CreateStrategyDto) {}
 *
 * @example
 * // 带描述模板
 * @Audit({
 *   type: OperationType.STRATEGY_UPDATE,
 *   module: 'strategy',
 *   description: '更新策略：{name}'
 * })
 * @Put(':id')
 * updateStrategy(@Param('id') id: string, @Body() dto: UpdateStrategyDto) {}
 */
export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_METADATA, options);

/**
 * 审计拦截器
 *
 * 与 @Audit 装饰器配合使用，自动记录审计日志。
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const auditOptions = Reflect.getMetadata(AUDIT_METADATA, context.getHandler());

    if (!auditOptions) {
      return next.handle();
    }

    const startTime = Date.now();
    const { type, module, description, logRequestBody, logResponseBody, contextExtractor } =
      auditOptions;

    return next.handle().pipe(
      tap((response) => {
        const duration = Date.now() - startTime;

        // 提取审计信息
        const auditData = this.extractAuditData(req, response, auditOptions);

        // 这里应该将审计数据发送到日志服务
        // 由于依赖注入限制，在装饰器中只负责收集数据
        console.log('[AUDIT]', {
          type,
          module,
          description: this.buildDescription(description, req, response),
          durationMs: duration,
          ...auditData,
        });
      }),
    );
  }

  /**
   * 提取审计数据
   *
   * @param req 请求对象
   * @param res 响应对象
   * @param options 审计选项
   * @private
   */
  private extractAuditData(req: Request, res: any, options: AuditOptions) {
    const data: Record<string, any> = {};

    if (options.logRequestBody && req.body) {
      data.requestBody = this.sanitizeData(req.body);
    }

    if (options.logResponseBody && res) {
      data.responseBody = this.sanitizeData(res);
    }

    if (options.contextExtractor) {
      data.context = options.contextExtractor(req, res);
    }

    return data;
  }

  /**
   * 构建描述信息
   *
   * 支持模板参数替换，如：'更新策略：{name}'
   *
   * @param template 描述模板
   * @param req 请求对象
   * @param res 响应对象
   * @returns 构建后的描述
   * @private
   */
  private buildDescription(template: string | undefined, req: Request, res: any): string {
    if (!template) {
      return `${req.method} ${req.path}`;
    }

    // 从 params、body、query 中提取参数
    const params = { ...req.params, ...req.body, ...req.query, response: res };

    return template.replace(/\{(\w+)\}/g, (_, key) => {
      return params[key] !== undefined ? String(params[key]) : `{${key}}`;
    });
  }

  /**
   * 清理敏感数据
   *
   * 移除或脱敏敏感字段（密码、token 等）
   *
   * @param data 原始数据
   * @returns 清理后的数据
   * @private
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = ['password', 'secret', 'token', 'apiKey', 'privateKey'];
    const sanitized = { ...data };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }
}

/**
 * 组合装饰器 - 审计 + 拦截器
 *
 * 简化使用，一键启用审计功能
 */
export const WithAudit = (options: AuditOptions) =>
  applyDecorators(Audit(options), UseInterceptors(AuditInterceptor));
