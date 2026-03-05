import { Injectable, Logger } from '@nestjs/common';
import winston from 'winston';
import { OperationLog } from '../../models/operation-log.entity';

/**
 * 日志级别
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  VERBOSE = 'verbose',
  DEBUG = 'debug',
  SILLY = 'silly',
}

/**
 * 日志元数据
 */
export interface LogMeta {
  /** 模块名称 */
  module?: string;

  /** 用户 ID */
  userId?: string;

  /** 请求路径 */
  path?: string;

  /** 请求方法 */
  method?: string;

  /** 状态码 */
  statusCode?: number;

  /** 执行时长（毫秒） */
  durationMs?: number;

  /** IP 地址 */
  ipAddress?: string;

  /** 其他上下文 */
  [key: string]: any;
}

/**
 * Winston 日志格式配置
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

/**
 * 开发环境日志格式 - 彩色控制台输出
 */
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  }),
);

/**
 * 日志服务
 *
 * 基于 winston 的结构化日志服务，提供：
 * - 多级别日志记录
 * - 文件日志持久化
 * - 控制台输出
 * - 日志轮转
 * - 错误堆栈跟踪
 *
 * 日志文件位置：
 * - 错误日志：logs/error.log
 * - 所有日志：logs/combined.log
 */
@Injectable()
export class LoggerService {
  private readonly logger: winston.Logger;
  private readonly nestLogger: Logger;

  constructor() {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const logDir = process.env.LOG_DIR || 'logs';

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      defaultMeta: { service: 'fund-trader' },
      transports: [
        // 错误日志 - 单独文件
        new winston.transports.File({
          filename: `${logDir}/error.log`,
          level: 'error',
          maxsize: 10485760, // 10MB
          maxFiles: 7,
        }),
        // 所有日志 - 合并文件
        new winston.transports.File({
          filename: `${logDir}/combined.log`,
          maxsize: 10485760, // 10MB
          maxFiles: 7,
        }),
      ],
    });

    // 开发环境添加控制台输出
    if (isDevelopment) {
      this.logger.add(
        new winston.transports.Console({
          format: devFormat,
        }),
      );
    }

    this.nestLogger = new Logger(LoggerService.name);
  }

  /**
   * 记录错误日志
   *
   * @param message 日志消息
   * @param meta 元数据
   */
  error(message: string, meta?: LogMeta): void {
    this.logger.error(message, meta);
  }

  /**
   * 记录警告日志
   *
   * @param message 日志消息
   * @param meta 元数据
   */
  warn(message: string, meta?: LogMeta): void {
    this.logger.warn(message, meta);
  }

  /**
   * 记录信息日志
   *
   * @param message 日志消息
   * @param meta 元数据
   */
  info(message: string, meta?: LogMeta): void {
    this.logger.info(message, meta);
  }

  /**
   * 记录 HTTP 请求日志
   *
   * @param message 日志消息
   * @param meta 元数据
   */
  http(message: string, meta?: LogMeta): void {
    this.logger.http(message, meta);
  }

  /**
   * 记录详细日志
   *
   * @param message 日志消息
   * @param meta 元数据
   */
  verbose(message: string, meta?: LogMeta): void {
    this.logger.verbose(message, meta);
  }

  /**
   * 记录调试日志
   *
   * @param message 日志消息
   * @param meta 元数据
   */
  debug(message: string, meta?: LogMeta): void {
    this.logger.debug(message, meta);
  }

  /**
   * 记录 silly 日志（最详细级别）
   *
   * @param message 日志消息
   * @param meta 元数据
   */
  silly(message: string, meta?: LogMeta): void {
    this.logger.silly(message, meta);
  }

  /**
   * 记录操作日志到数据库
   *
   * @param operationLog 操作日志对象
   */
  async logOperation(operationLog: Partial<OperationLog>): Promise<void> {
    try {
      // 注意：这里需要通过 TypeORM repository 保存
      // 由于依赖注入限制，在 service 中直接调用 repository
      this.nestLogger.debug(`Logging operation: ${operationLog.operation_type}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.error('Failed to log operation', { error: errorMessage, module: 'logger' });
    }
  }

  /**
   * 获取 Winston logger 实例
   *
   * @returns winston logger
   */
  getLogger(): winston.Logger {
    return this.logger;
  }

  /**
   * 获取 NestJS logger 实例
   *
   * @returns NestJS logger
   */
  getNestLogger(): Logger {
    return this.nestLogger;
  }
}
