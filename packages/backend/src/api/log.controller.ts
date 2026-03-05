import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseEnumPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiResponse,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { OperationLog, OperationType, OperationStatus } from '../models/operation-log.entity';
import { OperationLogService } from '../core/logger/operation-log.service';

/**
 * 创建操作日志 DTO（用于手动记录）
 */
class CreateOperationLogDto {
  @ApiPropertyOptional({ description: '用户 ID' })
  userId?: string;

  @ApiProperty({ description: '操作类型', enum: OperationType })
  type: OperationType;

  @ApiProperty({ description: '模块', example: 'strategy' })
  module: string;

  @ApiProperty({ description: '操作描述' })
  description: string;

  @ApiPropertyOptional({ description: '上下文', type: Object })
  context?: Record<string, any>;
}

/**
 * 日志查询响应
 */
class LogQueryResponse {
  @ApiProperty({ description: '日志列表', type: [OperationLog] })
  data: OperationLog[];

  @ApiProperty({ description: '总数' })
  total: number;

  @ApiProperty({ description: '页码' })
  page: number;

  @ApiProperty({ description: '每页数量' })
  limit: number;

  @ApiProperty({ description: '总页数' })
  totalPages: number;
}

/**
 * 操作统计响应
 */
class OperationStatsResponse {
  @ApiProperty({ description: '总操作数' })
  total: number;

  @ApiProperty({ description: '成功操作数' })
  success: number;

  @ApiProperty({ description: '失败操作数' })
  failure: number;

  @ApiProperty({ description: '按类型统计', type: Object })
  byType: Record<string, number>;

  @ApiProperty({ description: '按模块统计', type: Object })
  byModule: Record<string, number>;
}

/**
 * 日志控制器
 *
 * 提供操作日志查询和管理功能。
 */
@ApiTags('日志审计')
@Controller('logs')
export class LogController {
  constructor(private readonly logService: OperationLogService) {}

  /**
   * 分页查询操作日志
   *
   * 支持多种过滤条件：
   * - 用户 ID
   * - 操作类型
   * - 模块
   * - 状态
   * - 时间范围
   * - 关键词搜索
   */
  @Get()
  @ApiOperation({ summary: '查询操作日志' })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'operationType', required: false, enum: OperationType })
  @ApiQuery({ name: 'module', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: OperationStatus })
  @ApiQuery({ name: 'startTime', required: false, type: Date })
  @ApiQuery({ name: 'endTime', required: false, type: Date })
  @ApiQuery({ name: 'keyword', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: '返回操作日志列表',
    type: LogQueryResponse,
  })
  async findAll(
    @Query('userId') userId?: string,
    @Query('operationType', new ParseEnumPipe(OperationType, { optional: true }))
    operationType?: OperationType,
    @Query('module') module?: string,
    @Query('status', new ParseEnumPipe(OperationStatus, { optional: true }))
    status?: OperationStatus,
    @Query('startTime') startTime?: Date,
    @Query('endTime') endTime?: Date,
    @Query('keyword') keyword?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('sortBy') sortBy: 'created_at' | 'duration_ms' = 'created_at',
    @Query('sortOrder') sortOrder: 'ASC' | 'DESC' = 'DESC',
  ) {
    return this.logService.findAll({
      userId,
      operationType,
      module,
      status,
      startTime,
      endTime,
      keyword,
      page,
      limit,
      sortBy,
      sortOrder,
    });
  }

  /**
   * 根据 ID 查询操作日志详情
   */
  @Get(':id')
  @ApiOperation({ summary: '查询操作日志详情' })
  @ApiParam({ name: 'id', description: '日志 ID', type: String })
  @ApiResponse({ status: 200, type: OperationLog })
  @ApiResponse({ status: 404, description: '日志未找到' })
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<OperationLog | null> {
    return this.logService.findById(id);
  }

  /**
   * 获取用户的操作日志
   */
  @Get('user/:userId')
  @ApiOperation({ summary: '查询用户操作日志' })
  @ApiParam({ name: 'userId', description: '用户 ID', type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, default: 50 })
  @ApiResponse({ status: 200, type: [OperationLog] })
  async findByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('limit') limit: number = 50,
  ): Promise<OperationLog[]> {
    return this.logService.findByUser(userId, limit);
  }

  /**
   * 获取操作统计信息
   */
  @Get('stats/range')
  @ApiOperation({ summary: '获取操作统计' })
  @ApiQuery({ name: 'startTime', description: '开始时间', type: Date })
  @ApiQuery({ name: 'endTime', description: '结束时间', type: Date })
  @ApiResponse({ status: 200, type: OperationStatsResponse })
  async getStatistics(@Query('startTime') startTime: Date, @Query('endTime') endTime: Date) {
    return this.logService.getStatistics(startTime, endTime);
  }

  /**
   * 手动创建操作日志记录
   *
   * 用于记录系统自动执行的操作
   */
  @Post()
  @ApiOperation({ summary: '创建操作日志' })
  @ApiBody({ type: CreateOperationLogDto })
  @ApiResponse({ status: 201, type: OperationLog })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateOperationLogDto): Promise<OperationLog> {
    return this.logService.create({
      user_id: dto.userId,
      operation_type: dto.type,
      module: dto.module,
      description: dto.description,
      context: dto.context,
      status: OperationStatus.SUCCESS,
    });
  }
}
