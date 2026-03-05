import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from './user.entity';

/**
 * 操作日志类型
 */
export enum OperationType {
  // 认证相关
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',

  // 策略管理
  STRATEGY_CREATE = 'STRATEGY_CREATE',
  STRATEGY_UPDATE = 'STRATEGY_UPDATE',
  STRATEGY_DELETE = 'STRATEGY_DELETE',
  STRATEGY_ENABLE = 'STRATEGY_ENABLE',
  STRATEGY_DISABLE = 'STRATEGY_DISABLE',

  // 交易相关
  TRADE_BUY = 'TRADE_BUY',
  TRADE_SELL = 'TRADE_SELL',
  TRADE_CANCEL = 'TRADE_CANCEL',
  TRADE_CONFIRM = 'TRADE_CONFIRM',

  // 持仓管理
  POSITION_REFRESH = 'POSITION_REFRESH',
  POSITION_TRANSFER = 'POSITION_TRANSFER',

  // 风控配置
  RISK_LIMIT_CREATE = 'RISK_LIMIT_CREATE',
  RISK_LIMIT_UPDATE = 'RISK_LIMIT_UPDATE',
  RISK_LIMIT_DELETE = 'RISK_LIMIT_DELETE',
  BLACKLIST_ADD = 'BLACKLIST_ADD',
  BLACKLIST_REMOVE = 'BLACKLIST_REMOVE',

  // 系统配置
  USER_UPDATE = 'USER_UPDATE',
  NOTIFICATION_CONFIG_UPDATE = 'NOTIFICATION_CONFIG_UPDATE',

  // 数据同步
  DATA_SYNC_FUND = 'DATA_SYNC_FUND',
  DATA_SYNC_NAV = 'DATA_SYNC_NAV',
  DATA_SYNC_POSITION = 'DATA_SYNC_POSITION',

  // 其他
  MANUAL_OPERATION = 'MANUAL_OPERATION',
  SYSTEM_OPERATION = 'SYSTEM_OPERATION',
}

/**
 * 操作状态
 */
export enum OperationStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PENDING = 'pending',
}

/**
 * 操作日志实体
 */
@Entity('operation_logs')
@Index(['created_at'])
@Index(['user_id'])
@Index(['operation_type'])
@Index(['status'])
export class OperationLog {
  @ApiProperty({ description: '日志 ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiPropertyOptional({ description: '用户 ID' })
  @Column({ nullable: true })
  user_id?: string;

  @ApiPropertyOptional({ description: '用户', type: User })
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ApiProperty({ description: '操作类型', enum: OperationType })
  @Column({ type: 'enum', enum: OperationType })
  operation_type: OperationType;

  @ApiProperty({ description: '操作状态', enum: OperationStatus })
  @Column({ type: 'enum', enum: OperationStatus, default: OperationStatus.SUCCESS })
  status: OperationStatus;

  @ApiProperty({ description: '操作模块' })
  @Column()
  module: string;

  @ApiProperty({ description: '操作描述' })
  @Column({ type: 'text' })
  description: string;

  @ApiPropertyOptional({ description: '请求路径' })
  @Column({ nullable: true })
  request_path?: string;

  @ApiPropertyOptional({ description: '请求方法' })
  @Column({ nullable: true })
  request_method?: string;

  @ApiPropertyOptional({ description: '请求参数', type: Object })
  @Column({ type: 'jsonb', nullable: true })
  request_params?: Record<string, any>;

  @ApiPropertyOptional({ description: '响应状态码' })
  @Column({ nullable: true })
  response_status?: number;

  @ApiPropertyOptional({ description: '错误消息' })
  @Column({ type: 'text', nullable: true })
  error_message?: string;

  @ApiPropertyOptional({ description: '额外上下文', type: Object })
  @Column({ type: 'jsonb', nullable: true })
  context?: Record<string, any>;

  @ApiPropertyOptional({ description: 'IP 地址' })
  @Column({ nullable: true })
  ip_address?: string;

  @ApiPropertyOptional({ description: 'User-Agent' })
  @Column({ nullable: true })
  user_agent?: string;

  @ApiPropertyOptional({ description: '执行时长（毫秒）' })
  @Column({ nullable: true })
  duration_ms?: number;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn()
  created_at: Date;

  /**
   * 获取模块前缀
   */
  static getModulePrefix(module: string): string {
    const modules: Record<string, string> = {
      auth: '[AUTH]',
      strategy: '[STRATEGY]',
      trade: '[TRADE]',
      position: '[POSITION]',
      risk: '[RISK]',
      system: '[SYSTEM]',
      analytics: '[ANALYTICS]',
      log: '[LOG]',
    };
    return modules[module] || `[${module.toUpperCase()}]`;
  }
}
