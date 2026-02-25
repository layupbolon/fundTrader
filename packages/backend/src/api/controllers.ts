import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Strategy, Position, Transaction, Fund } from '../models';
import { BacktestEngine, BacktestResult } from '../core/backtest/backtest.engine';
import { CreateStrategyDto, BacktestDto } from './dto';

@ApiTags('strategies')
@Controller('strategies')
export class StrategyController {
  constructor(
    @InjectRepository(Strategy)
    private strategyRepository: Repository<Strategy>,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取策略列表', description: '获取所有策略或指定用户的策略' })
  @ApiQuery({ name: 'user_id', required: false, description: '用户ID（可选）' })
  @ApiResponse({ status: 200, description: '成功返回策略列表' })
  async findAll(@Query('user_id') userId?: string) {
    const where = userId ? { user_id: userId } : {};
    return this.strategyRepository.find({ where, relations: ['fund'] });
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
  async create(@Body() createDto: CreateStrategyDto) {
    const strategy = this.strategyRepository.create(createDto);
    return this.strategyRepository.save(strategy);
  }

  @Post(':id/toggle')
  @ApiOperation({ summary: '切换策略状态', description: '启用或禁用指定策略' })
  @ApiParam({ name: 'id', description: '策略ID' })
  @ApiResponse({ status: 200, description: '策略状态切换成功' })
  @ApiResponse({ status: 404, description: '策略不存在' })
  async toggle(@Param('id') id: string) {
    const strategy = await this.strategyRepository.findOne({ where: { id } });
    if (!strategy) {
      throw new Error('Strategy not found');
    }
    strategy.enabled = !strategy.enabled;
    return this.strategyRepository.save(strategy);
  }
}

@ApiTags('positions')
@Controller('positions')
export class PositionController {
  constructor(
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取持仓列表', description: '获取所有持仓或指定用户的持仓' })
  @ApiQuery({ name: 'user_id', required: false, description: '用户ID（可选）' })
  @ApiResponse({ status: 200, description: '成功返回持仓列表' })
  async findAll(@Query('user_id') userId?: string) {
    const where = userId ? { user_id: userId } : {};
    return this.positionRepository.find({
      where,
      relations: ['fund', 'user'],
      order: { updated_at: 'DESC' },
    });
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

@ApiTags('transactions')
@Controller('transactions')
export class TransactionController {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取交易记录', description: '获取交易记录列表，支持按用户和基金筛选' })
  @ApiQuery({ name: 'user_id', required: false, description: '用户ID（可选）' })
  @ApiQuery({ name: 'fund_code', required: false, description: '基金代码（可选）' })
  @ApiQuery({ name: 'limit', required: false, description: '返回记录数量限制', example: 50 })
  @ApiResponse({ status: 200, description: '成功返回交易记录列表' })
  async findAll(
    @Query('user_id') userId?: string,
    @Query('fund_code') fundCode?: string,
    @Query('limit') limit: number = 50,
  ) {
    const where: any = {};
    if (userId) where.user_id = userId;
    if (fundCode) where.fund_code = fundCode;

    return this.transactionRepository.find({
      where,
      relations: ['fund', 'strategy'],
      order: { submitted_at: 'DESC' },
      take: limit,
    });
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

@ApiTags('funds')
@Controller('funds')
export class FundController {
  constructor(
    @InjectRepository(Fund)
    private fundRepository: Repository<Fund>,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取基金列表', description: '获取所有基金信息' })
  @ApiResponse({ status: 200, description: '成功返回基金列表' })
  async findAll() {
    return this.fundRepository.find({
      order: { updated_at: 'DESC' },
    });
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

@ApiTags('backtest')
@Controller('backtest')
export class BacktestController {
  constructor(private backtestEngine: BacktestEngine) {}

  @Post()
  @ApiOperation({
    summary: '运行策略回测',
    description: '使用历史数据回测交易策略，计算收益率、夏普比率、最大回撤等指标',
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

    return this.backtestEngine.runBacktest({
      fund_code,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      initial_capital,
      strategy_config,
    });
  }
}
