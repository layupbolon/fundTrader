import { Injectable, Logger } from '@nestjs/common';
import { OperationLog, OperationType, OperationStatus } from '../../models/operation-log.entity';
import { Repository, Like, Between } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';

/**
 * 操作日志查询条件
 */
export interface OperationLogFilter {
  /** 用户 ID */
  userId?: string;

  /** 操作类型 */
  operationType?: OperationType;

  /** 模块 */
  module?: string;

  /** 状态 */
  status?: OperationStatus;

  /** 开始时间 */
  startTime?: Date;

  /** 结束时间 */
  endTime?: Date;

  /** 搜索关键词（描述、路径） */
  keyword?: string;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  limit?: number;

  /** 排序字段 */
  sortBy?: 'created_at' | 'duration_ms';

  /** 排序方向 */
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaperTradingRunEvent {
  logId: string;
  transactionId?: string;
  orderId?: string;
  description: string;
  reason?: string;
  status?: string;
  manualInterventionRequired: boolean;
  brokerEvidence?: PaperTradingBrokerEvidence;
  createdAt: Date;
}

export interface PaperTradingBrokerEvidence {
  capturedAt?: string;
  operation?: string;
  hasScreenshot?: boolean;
  domSummaryPreview?: string;
}

export interface PaperTradingRunSummary {
  runId: string;
  transactionId?: string;
  orderId?: string;
  brokerOrderCreatedAt?: string;
  submittedCount: number;
  failedCount: number;
  manualInterventionCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  latestReason?: string;
  events: PaperTradingRunEvent[];
}

/**
 * 操作日志服务
 *
 * 提供操作日志的 CRUD 和查询功能。
 */
@Injectable()
export class OperationLogService {
  private readonly logger = new Logger(OperationLogService.name);

  constructor(
    @InjectRepository(OperationLog)
    private readonly operationLogRepository: Repository<OperationLog>,
  ) {}

  /**
   * 创建操作日志记录
   *
   * @param log 操作日志数据
   * @returns 保存后的日志记录
   */
  async create(log: Partial<OperationLog>): Promise<OperationLog> {
    try {
      const operationLog = this.operationLogRepository.create(log);
      return await this.operationLogRepository.save(operationLog);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create operation log: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 记录用户操作
   *
   * @param userId 用户 ID
   * @param type 操作类型
   * @param module 模块
   * @param description 描述
   * @param context 上下文
   * @returns 操作日志记录
   */
  async logUserAction(
    userId: string,
    type: OperationType,
    module: string,
    description: string,
    context?: Record<string, any>,
  ): Promise<OperationLog> {
    return this.create({
      user_id: userId,
      operation_type: type,
      module,
      description,
      status: OperationStatus.SUCCESS,
      context,
    });
  }

  /**
   * 记录系统操作
   *
   * @param type 操作类型
   * @param module 模块
   * @param description 描述
   * @param context 上下文
   * @returns 操作日志记录
   */
  async logSystemAction(
    type: OperationType,
    module: string,
    description: string,
    context?: Record<string, any>,
  ): Promise<OperationLog> {
    return this.create({
      operation_type: type,
      module,
      description,
      status: OperationStatus.SUCCESS,
      context,
    });
  }

  /**
   * 记录操作失败
   *
   * @param userId 用户 ID（可选）
   * @param type 操作类型
   * @param module 模块
   * @param description 描述
   * @param errorMessage 错误消息
   * @returns 操作日志记录
   */
  async logFailure(
    type: OperationType,
    module: string,
    description: string,
    errorMessage: string,
    userId?: string,
  ): Promise<OperationLog> {
    return this.create({
      user_id: userId,
      operation_type: type,
      module,
      description,
      status: OperationStatus.FAILURE,
      error_message: errorMessage,
    });
  }

  /**
   * 记录 HTTP 请求日志
   *
   * @param request HTTP 请求
   * @param durationMs 执行时长
   * @param statusCode 响应状态码
   * @param userId 用户 ID（可选）
   * @returns 操作日志记录
   */
  async logHttpRequest(
    request: Request,
    durationMs: number,
    statusCode: number,
    userId?: string,
  ): Promise<OperationLog> {
    return this.create({
      user_id: userId,
      operation_type: OperationType.MANUAL_OPERATION,
      module: 'api',
      description: `${request.method} ${request.path}`,
      status: statusCode >= 400 ? OperationStatus.FAILURE : OperationStatus.SUCCESS,
      request_path: request.path,
      request_method: request.method,
      request_params: {
        query: request.query,
        body: request.body,
        params: request.params,
      },
      response_status: statusCode,
      duration_ms: durationMs,
      ip_address: this.getClientIp(request),
      user_agent: request.headers['user-agent'],
    });
  }

  /**
   * 分页查询操作日志
   *
   * @param filter 查询条件
   * @returns 分页结果
   */
  async findAll(filter: OperationLogFilter): Promise<{
    data: OperationLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC' } = filter;

    const where: any = {};

    // 用户 ID 过滤
    if (filter.userId) {
      where.user_id = filter.userId;
    }

    // 操作类型过滤
    if (filter.operationType) {
      where.operation_type = filter.operationType;
    }

    // 模块过滤
    if (filter.module) {
      where.module = filter.module;
    }

    // 状态过滤
    if (filter.status) {
      where.status = filter.status;
    }

    // 时间范围过滤
    if (filter.startTime || filter.endTime) {
      where.created_at = Between(filter.startTime || new Date(0), filter.endTime || new Date());
    }

    // 关键词搜索
    if (filter.keyword) {
      const keyword = Like(`%${filter.keyword}%`);
      return this.operationLogRepository
        .findAndCount({
          where: [
            { ...where, description: keyword },
            { ...where, request_path: keyword },
          ],
          skip: (page - 1) * limit,
          take: limit,
          order: { [sortBy]: sortOrder },
        })
        .then(([data, total]) => ({
          data,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        }));
    }

    return this.operationLogRepository
      .findAndCount({
        where,
        skip: (page - 1) * limit,
        take: limit,
        order: { [sortBy]: sortOrder },
      })
      .then(([data, total]) => ({
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }));
  }

  async findPaperTradingRuns(
    days: number = 7,
    limit: number = 20,
  ): Promise<PaperTradingRunSummary[]> {
    const since = new Date();
    since.setDate(since.getDate() - Math.max(1, Math.min(days, 365)));

    const logs = await this.operationLogRepository
      .createQueryBuilder('log')
      .where("log.context ->> 'broker_mode' = :mode", { mode: 'paper' })
      .andWhere('log.module = :module', { module: 'trade' })
      .andWhere('log.created_at >= :since', { since })
      .orderBy('log.created_at', 'DESC')
      .limit(Math.max(1, Math.min(limit * 10, 500)))
      .getMany();

    const runs = new Map<string, PaperTradingRunSummary>();

    for (const log of logs) {
      const context = (log.context || {}) as Record<string, unknown>;
      const transactionId = this.readString(context.transaction_id);
      const orderId = this.readString(context.order_id);
      const runId =
        this.readString(context.paper_trading_run_id) || orderId || transactionId || log.id;
      const reason = this.readString(context.reason);
      const status = this.readString(context.new_status);
      const manualInterventionRequired = context.manual_intervention_required === true;
      const createdAt = log.created_at;
      const existing = runs.get(runId);
      const event: PaperTradingRunEvent = {
        logId: log.id,
        transactionId,
        orderId,
        description: log.description,
        reason,
        status,
        manualInterventionRequired,
        brokerEvidence: this.readBrokerEvidence(context.broker_evidence),
        createdAt,
      };

      if (!existing) {
        runs.set(runId, {
          runId,
          transactionId,
          orderId,
          brokerOrderCreatedAt: this.readString(context.broker_order_created_at),
          submittedCount: reason === 'broker_submit_success' ? 1 : 0,
          failedCount: this.isPaperFailure(reason, status) ? 1 : 0,
          manualInterventionCount: manualInterventionRequired ? 1 : 0,
          firstSeenAt: createdAt,
          lastSeenAt: createdAt,
          latestReason: reason,
          events: [event],
        });
        continue;
      }

      existing.transactionId ||= transactionId;
      existing.orderId ||= orderId;
      existing.brokerOrderCreatedAt ||= this.readString(context.broker_order_created_at);
      existing.firstSeenAt =
        createdAt.getTime() < existing.firstSeenAt.getTime() ? createdAt : existing.firstSeenAt;
      existing.lastSeenAt =
        createdAt.getTime() > existing.lastSeenAt.getTime() ? createdAt : existing.lastSeenAt;
      existing.latestReason ||= reason;
      existing.submittedCount += reason === 'broker_submit_success' ? 1 : 0;
      existing.failedCount += this.isPaperFailure(reason, status) ? 1 : 0;
      existing.manualInterventionCount += manualInterventionRequired ? 1 : 0;
      existing.events.push(event);
    }

    return Array.from(runs.values())
      .sort((left, right) => right.lastSeenAt.getTime() - left.lastSeenAt.getTime())
      .slice(0, Math.max(1, Math.min(limit, 100)));
  }

  /**
   * 根据 ID 查找操作日志
   *
   * @param id 日志 ID
   * @returns 操作日志记录
   */
  async findById(id: string): Promise<OperationLog | null> {
    return this.operationLogRepository.findOne({
      where: { id },
      relations: ['user'],
    });
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private readBrokerEvidence(value: unknown): PaperTradingBrokerEvidence | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const evidence = value as Record<string, unknown>;
    const domSummaryPreview =
      this.createDomSummaryPreview(evidence.domSummary) ||
      this.createDomSummaryPreview(evidence.domSummaryPreview);
    const brokerEvidence: PaperTradingBrokerEvidence = {
      capturedAt: this.readString(evidence.capturedAt),
      operation: this.readString(evidence.operation),
      hasScreenshot:
        typeof evidence.hasScreenshot === 'boolean'
          ? evidence.hasScreenshot
          : Boolean(this.readString(evidence.screenshotPath)),
      domSummaryPreview,
    };

    return Object.values(brokerEvidence).some(Boolean) ? brokerEvidence : undefined;
  }

  private createDomSummaryPreview(value: unknown): string | undefined {
    const text = this.readString(value);
    if (!text) {
      return undefined;
    }

    return text.replace(/\s+/g, ' ').trim().slice(0, 160);
  }

  private isPaperFailure(reason?: string, status?: string): boolean {
    return (
      status === 'FAILED' ||
      reason === 'broker_submit_failed' ||
      reason === 'broker_order_persist_failed'
    );
  }

  /**
   * 获取用户的操作日志
   *
   * @param userId 用户 ID
   * @param limit 数量限制
   * @returns 操作日志列表
   */
  async findByUser(userId: string, limit: number = 50): Promise<OperationLog[]> {
    return this.operationLogRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }

  /**
   * 获取特定时间段内的操作统计
   *
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns 统计数据
   */
  async getStatistics(
    startTime: Date,
    endTime: Date,
  ): Promise<{
    total: number;
    success: number;
    failure: number;
    byType: Record<string, number>;
    byModule: Record<string, number>;
  }> {
    const where = {
      created_at: Between(startTime, endTime),
    };

    const [total, success, failure] = await Promise.all([
      this.operationLogRepository.count({ where }),
      this.operationLogRepository.count({ where: { ...where, status: OperationStatus.SUCCESS } }),
      this.operationLogRepository.count({ where: { ...where, status: OperationStatus.FAILURE } }),
    ]);

    // 按类型统计
    const byTypeRaw = await this.operationLogRepository
      .createQueryBuilder('log')
      .select('log.operation_type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where(where)
      .groupBy('log.operation_type')
      .getRawMany();

    // 按模块统计
    const byModuleRaw = await this.operationLogRepository
      .createQueryBuilder('log')
      .select('log.module', 'module')
      .addSelect('COUNT(*)', 'count')
      .where(where)
      .groupBy('log.module')
      .getRawMany();

    const byType = byTypeRaw.reduce(
      (acc, row) => {
        acc[row.type] = parseInt(row.count);
        return acc;
      },
      {} as Record<string, number>,
    );

    const byModule = byModuleRaw.reduce(
      (acc, row) => {
        acc[row.module] = parseInt(row.count);
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total,
      success,
      failure,
      byType,
      byModule,
    };
  }

  /**
   * 清理过期日志
   *
   * @param beforeDate 删除此日期之前的日志
   * @returns 删除的数量
   */
  async cleanup(beforeDate: Date): Promise<number> {
    const result = await this.operationLogRepository
      .createQueryBuilder()
      .delete()
      .where('created_at < :date', { date: beforeDate })
      .execute();

    return result.affected || 0;
  }

  /**
   * 获取客户端 IP
   */
  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'] as string;
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}
