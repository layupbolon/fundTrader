import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ValidationPipe,
  UsePipes,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Strategy, Position, Transaction, Fund, BacktestResult as BacktestResultEntity } from '../models';
import { BacktestEngine, BacktestResult } from '../core/backtest/backtest.engine';
import { CreateStrategyDto, UpdateStrategyDto, BacktestDto } from './dto';
import { PaginationDto } from './pagination.dto';
import { createPaginatedResponse } from './paginated-response';
import { CurrentUser } from '../auth/user.decorator';
import { validateStrategyConfig } from './dto/strategy-config';

@ApiBearerAuth()
@ApiTags('strategies')
@Controller('strategies')
export class StrategyController {
  constructor(
    @InjectRepository(Strategy)
    private strategyRepository: Repository<Strategy>,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取策略列表', description: '获取当前用户的策略列表（分页）' })
  @ApiResponse({ status: 200, description: '成功返回策略列表' })
  async findAll(
    @Query() pagination: PaginationDto,
    @CurrentUser() user: { id: string },
  ) {
    const { page, limit } = pagination;
    const [data, total] = await this.strategyRepository.findAndCount({
      where: { user_id: user.id },
      relations: ['fund'],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return createPaginatedResponse(data, total, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取策略详情', description: '根据ID获取单个策略的详细信息' })
  @ApiParam({ name: 'id', description: '策略ID' })
  @ApiResponse({ status: 200, description: '成功返回策略详情' })
  @ApiResponse({ status: 404, description: '策略不存在' })
  async findOne(@Param('id') id: string) {
    return this.strategyRepository.findOne({
      where: { id },
      relations: ['fund', 'user'],
    });
  }

  @Post()
  @ApiOperation({ summary: '创建策略', description: '创建新的交易策略（定投或止盈止损）' })
  @ApiResponse({ status: 201, description: '策略创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(
    @Body() createDto: CreateStrategyDto,
    @CurrentUser() user: { id: string },
  ) {
    await validateStrategyConfig(createDto.type, createDto.config);
    const strategy = this.strategyRepository.create({
      ...createDto,
      user_id: user.id,
    });
    return this.strategyRepository.save(strategy);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新策略', description: '更新策略名称、配置或启用状态' })
  @ApiParam({ name: 'id', description: '策略ID' })
  @ApiResponse({ status: 200, description: '策略更新成功' })
  @ApiResponse({ status: 403, description: '无权操作该策略' })
  @ApiResponse({ status: 404, description: '策略不存在' })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateStrategyDto,
    @CurrentUser() user: { id: string },
  ) {
    const strategy = await this.strategyRepository.findOne({ where: { id } });
    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }
    if (strategy.user_id !== user.id) {
      throw new ForbiddenException('You do not have permission to update this strategy');
    }
    if (updateDto.config) {
      await validateStrategyConfig(strategy.type, updateDto.config);
    }
    const updated = { ...strategy, ...updateDto };
    return this.strategyRepository.save(updated);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除策略', description: '永久删除策略' })
  @ApiParam({ name: 'id', description: '策略ID' })
  @ApiResponse({ status: 200, description: '策略删除成功' })
  @ApiResponse({ status: 403, description: '无权操作该策略' })
  @ApiResponse({ status: 404, description: '策略不存在' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    const strategy = await this.strategyRepository.findOne({ where: { id } });
    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }
    if (strategy.user_id !== user.id) {
      throw new ForbiddenException('You do not have permission to delete this strategy');
    }
    await this.strategyRepository.remove(strategy);
    return { message: 'Strategy deleted successfully' };
  }

  @Post(':id/toggle')
  @ApiOperation({ summary: '切换策略状态', description: '启用或禁用指定策略' })
  @ApiParam({ name: 'id', description: '策略ID' })
  @ApiResponse({ status: 200, description: '策略状态切换成功' })
  @ApiResponse({ status: 404, description: '策略不存在' })
  async toggle(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    const strategy = await this.strategyRepository.findOne({ where: { id } });
    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }
    if (strategy.user_id !== user.id) {
      throw new ForbiddenException('You do not have permission to toggle this strategy');
    }
    const updated = { ...strategy, enabled: !strategy.enabled };
    return this.strategyRepository.save(updated);
  }
}

@ApiBearerAuth()
@ApiTags('positions')
@Controller('positions')
export class PositionController {
  constructor(
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取持仓列表', description: '获取当前用户的持仓列表（分页）' })
  @ApiResponse({ status: 200, description: '成功返回持仓列表' })
  async findAll(
    @Query() pagination: PaginationDto,
    @CurrentUser() user: { id: string },
  ) {
    const { page, limit } = pagination;
    const [data, total] = await this.positionRepository.findAndCount({
      where: { user_id: user.id },
      relations: ['fund', 'user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { updated_at: 'DESC' },
    });
    return createPaginatedResponse(data, total, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取持仓详情', description: '根据ID获取单个持仓的详细信息' })
  @ApiParam({ name: 'id', description: '持仓ID' })
  @ApiResponse({ status: 200, description: '成功返回持仓详情' })
  @ApiResponse({ status: 404, description: '持仓不存在' })
  async findOne(@Param('id') id: string) {
    return this.positionRepository.findOne({
      where: { id },
      relations: ['fund', 'user'],
    });
  }
}

@ApiBearerAuth()
@ApiTags('transactions')
@Controller('transactions')
export class TransactionController {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取交易记录', description: '获取交易记录列表，支持按基金筛选（分页）' })
  @ApiQuery({ name: 'fund_code', required: false, description: '基金代码（可选）' })
  @ApiResponse({ status: 200, description: '成功返回交易记录列表' })
  async findAll(
    @Query() pagination: PaginationDto,
    @CurrentUser() user: { id: string },
    @Query('fund_code') fundCode?: string,
  ) {
    const { page, limit } = pagination;
    const where: any = { user_id: user.id };
    if (fundCode) where.fund_code = fundCode;

    const [data, total] = await this.transactionRepository.findAndCount({
      where,
      relations: ['fund', 'strategy'],
      skip: (page - 1) * limit,
      take: limit,
      order: { submitted_at: 'DESC' },
    });
    return createPaginatedResponse(data, total, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取交易详情', description: '根据ID获取单笔交易的详细信息' })
  @ApiParam({ name: 'id', description: '交易ID' })
  @ApiResponse({ status: 200, description: '成功返回交易详情' })
  @ApiResponse({ status: 404, description: '交易记录不存在' })
  async findOne(@Param('id') id: string) {
    return this.transactionRepository.findOne({
      where: { id },
      relations: ['fund', 'strategy', 'user'],
    });
  }
}

@ApiBearerAuth()
@ApiTags('funds')
@Controller('funds')
export class FundController {
  constructor(
    @InjectRepository(Fund)
    private fundRepository: Repository<Fund>,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取基金列表', description: '获取所有基金信息（分页）' })
  @ApiResponse({ status: 200, description: '成功返回基金列表' })
  async findAll(@Query() pagination: PaginationDto) {
    const { page, limit } = pagination;
    const [data, total] = await this.fundRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { updated_at: 'DESC' },
    });
    return createPaginatedResponse(data, total, page, limit);
  }

  @Get(':code')
  @ApiOperation({ summary: '获取基金详情', description: '根据基金代码获取基金详细信息' })
  @ApiParam({ name: 'code', description: '基金代码（6位数字）', example: '110011' })
  @ApiResponse({ status: 200, description: '成功返回基金详情' })
  @ApiResponse({ status: 404, description: '基金不存在' })
  async findOne(@Param('code') code: string) {
    return this.fundRepository.findOne({ where: { code } });
  }
}

@ApiBearerAuth()
@ApiTags('backtest')
@Controller('backtest')
export class BacktestController {
  constructor(
    private backtestEngine: BacktestEngine,
    @InjectRepository(BacktestResultEntity)
    private backtestResultRepository: Repository<BacktestResultEntity>,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取回测结果列表', description: '查询所有回测结果（分页）' })
  @ApiResponse({ status: 200, description: '成功返回回测结果列表' })
  async findAll(@Query() pagination: PaginationDto) {
    const { page, limit } = pagination;
    const [data, total] = await this.backtestResultRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return createPaginatedResponse(data, total, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取回测结果详情', description: '根据ID获取单个回测结果的详细信息' })
  @ApiParam({ name: 'id', description: '回测结果ID' })
  @ApiResponse({ status: 200, description: '成功返回回测结果详情' })
  @ApiResponse({ status: 404, description: '回测结果不存在' })
  async findOne(@Param('id') id: string) {
    return this.backtestResultRepository.findOne({ where: { id } });
  }

  @Post()
  @ApiOperation({
    summary: '运行策略回测',
    description: '使用历史数据回测交易策略，计算收益率、夏普比率、最大回撤等指标，结果自动保存到数据库',
  })
  @ApiResponse({
    status: 200,
    description: '回测成功，返回回测结果',
    schema: {
      example: {
        total_return: 0.15,
        annualized_return: 0.12,
        sharpe_ratio: 1.5,
        max_drawdown: 0.08,
        win_rate: 0.65,
        total_trades: 24,
      },
    },
  })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async runBacktest(@Body() params: BacktestDto): Promise<BacktestResult> {
    const { fund_code, start_date, end_date, initial_capital, strategy_config } = params;

    const result = await this.backtestEngine.runBacktest({
      fund_code,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      initial_capital,
      strategy_config,
    });

    // 持久化回测结果
    const entity = this.backtestResultRepository.create({
      strategy_config,
      fund_code,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      initial_capital,
      final_value: result.final_value,
      total_return: result.total_return,
      annual_return: result.annual_return,
      max_drawdown: result.max_drawdown,
      sharpe_ratio: result.sharpe_ratio,
      trades_count: result.trades_count,
    });
    await this.backtestResultRepository.save(entity);

    return result;
  }
}
