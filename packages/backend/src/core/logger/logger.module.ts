import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationLog } from '../../models/operation-log.entity';
import { LoggerService } from './logger.service';
import { OperationLogService } from './operation-log.service';

/**
 * 日志模块
 *
 * 提供全局日志服务，包括：
 * - Winston 结构化日志
 * - 操作日志数据库记录
 * - HTTP 请求日志拦截
 * - 审计装饰器
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OperationLog])],
  providers: [LoggerService, OperationLogService],
  exports: [LoggerService, OperationLogService],
})
export class LoggerModule {}
