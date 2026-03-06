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
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Queue } from 'bull';
import {
  Strategy,
  Position,
  Transaction,
  Fund,
  BacktestResult as BacktestResultEntity,
  TransactionType,
  TransactionStatus,
  OperationType,
} from '../models';
import { BacktestEngine, BacktestResult } from '../core/backtest/backtest.engine';
import {
  CreateStrategyDto,
  UpdateStrategyDto,
  BacktestDto,
  CreateTransactionDto,
} from './dto';
import { PaginationDto } from './pagination.dto';
import { createPaginatedResponse } from './paginated-response';
import { CurrentUser } from '../auth/user.decorator';
import { validateStrategyConfig } from './dto/strategy-config';
import { RiskControlService } from '../core/risk/risk-control.service';
import { TradingConfirmationService } from '../core/trading/trading-confirmation.service';
import { TiantianBrokerService } from '../services/broker/tiantian.service';
import { OperationLogService } from '../core/logger/operation-log.service';

@ApiBearerAuth()
@ApiTags('strategies')
@Controller('strategies')
export class StrategyController {
  constructor(
    @InjectRepository(Strategy)
    private strategyRepository: Repository<Strategy>,
    private riskControlService: RiskControlService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取策略列表', description: '获取当前用户的策略列表（分页）' })
  @ApiResponse({ status: 200, description: '成功返回策略列表' })
  async findAll(@Query() pagination: PaginationDto, @CurrentUser() user: { id: string }) {
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
  async create(@Body() createDto: CreateStrategyDto, @CurrentUser() user: { id: string }) {
    await validateStrategyConfig(createDto.type, createDto.config);

    // 风控检查：检查基金是否在黑名单中
    const blacklistCheck = await this.riskControlService.checkFundBlacklist(createDto.fund_code);
    if (!blacklistCheck.passed) {
      throw new BadRequestException(blacklistCheck.message);
    }

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
  async remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
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
  async findAll(@Query() pagination: PaginationDto, @CurrentUser() user: { id: string }) {
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
    @InjectRepository(Fund)
    private fundRepository: Repository<Fund>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    private riskControlService: RiskControlService,
    private tradingConfirmationService: TradingConfirmationService,
    private brokerService: TiantianBrokerService,
    private operationLogService: OperationLogService,
  ) {}

  @Get()
  @ApiOperation({
    summary: '获取交易记录',
    description: '获取交易记录列表，支持按基金筛选（分页）',
  })
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

  @Post()
  @ApiOperation({ summary: '创建交易', description: '手动创建一笔买入/卖出交易' })
  @ApiResponse({ status: 201, description: '交易创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误或风控拦截' })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() createDto: CreateTransactionDto, @CurrentUser() user: { id: string }) {
    const fund = await this.fundRepository.findOne({ where: { code: createDto.fund_code } });
    if (!fund) {
      throw new NotFoundException(`Fund ${createDto.fund_code} not found`);
    }

    const blacklistCheck = await this.riskControlService.checkFundBlacklist(createDto.fund_code);
    if (!blacklistCheck.passed) {
      throw new BadRequestException(blacklistCheck.message);
    }

    const tradeLimitCheck = await this.riskControlService.checkTradeLimit(
      user.id,
      createDto.amount,
      createDto.type,
    );
    if (!tradeLimitCheck.passed) {
      throw new BadRequestException(tradeLimitCheck.message);
    }

    if (createDto.type === TransactionType.BUY) {
      const positionLimitCheck = await this.riskControlService.checkPositionLimit(
        user.id,
        createDto.fund_code,
        createDto.amount,
      );
      if (!positionLimitCheck.passed) {
        throw new BadRequestException(positionLimitCheck.message);
      }
    }

    const needsConfirmation = await this.tradingConfirmationService.needsConfirmation(
      user.id,
      createDto.amount,
    );

    if (needsConfirmation) {
      const pending = await this.tradingConfirmationService.createPendingTransaction({
        userId: user.id,
        fundCode: createDto.fund_code,
        amount: createDto.amount,
        type: createDto.type,
        confirmationTimeoutMinutes: 30,
      });
      await this.tradingConfirmationService.sendConfirmationRequest(pending);

      await this.operationLogService.logUserAction(
        user.id,
        createDto.type === TransactionType.BUY ? OperationType.TRADE_BUY : OperationType.TRADE_SELL,
        'trade',
        `创建待确认交易 ${pending.id}`,
        {
          fund_code: createDto.fund_code,
          amount: createDto.amount,
          type: createDto.type,
          requires_confirmation: true,
        },
      );

      return {
        id: pending.id,
        status: pending.status,
        requires_confirmation: true,
      };
    }

    let orderId: string;
    let shares = createDto.shares;
    let amount = createDto.amount;

    if (createDto.type === TransactionType.BUY) {
      const order = await this.brokerService.buyFund(createDto.fund_code, amount);
      orderId = order.id;
    } else {
      const position = await this.positionRepository.findOne({
        where: { user_id: user.id, fund_code: createDto.fund_code },
      });

      if (!position || position.shares <= 0) {
        throw new BadRequestException(`No position found for fund ${createDto.fund_code}`);
      }

      if (!shares) {
        const referenceNav = Number(position.avg_price);
        if (!referenceNav || referenceNav <= 0) {
          throw new BadRequestException('Cannot estimate sell shares without valid NAV');
        }
        shares = createDto.amount / referenceNav;
      }

      if (shares > position.shares) {
        throw new BadRequestException('Sell shares exceed current position');
      }

      const order = await this.brokerService.sellFund(createDto.fund_code, shares);
      orderId = order.id;
      amount = createDto.amount || shares * Number(position.avg_price);
    }

    const transaction = this.transactionRepository.create({
      user_id: user.id,
      fund_code: createDto.fund_code,
      type: createDto.type,
      amount,
      shares,
      status: TransactionStatus.PENDING,
      order_id: orderId,
    });
    const saved = await this.transactionRepository.save(transaction);

    await this.operationLogService.logUserAction(
      user.id,
      createDto.type === TransactionType.BUY ? OperationType.TRADE_BUY : OperationType.TRADE_SELL,
      'trade',
      `创建交易 ${saved.id}`,
      {
        fund_code: createDto.fund_code,
        amount: saved.amount,
        type: createDto.type,
        shares: saved.shares,
        order_id: saved.order_id,
      },
    );

    return {
      id: saved.id,
      status: saved.status,
      requires_confirmation: false,
    };
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
@ApiTags('operations')
@Controller('operations')
export class OperationsController {
  constructor(
    @InjectQueue('data-sync')
    private dataSyncQueue: Queue,
    @InjectQueue('trading')
    private tradingQueue: Queue,
    private operationLogService: OperationLogService,
  ) {}

  @Post('sync-nav')
  @ApiOperation({ summary: '手动触发净值同步', description: '立即投递基金净值同步任务' })
  @ApiResponse({ status: 201, description: '任务投递成功' })
  async triggerNavSync(@CurrentUser() user: { id: string }) {
    const job = await this.dataSyncQueue.add(
      'sync-nav',
      { triggered_by: user.id, manual: true },
      { removeOnComplete: true },
    );

    await this.operationLogService.logUserAction(
      user.id,
      OperationType.DATA_SYNC_NAV,
      'ops',
      '手动触发净值同步',
      { job_id: job.id },
    );

    return { message: 'NAV sync job queued', job_id: job.id };
  }

  @Post('refresh-positions')
  @ApiOperation({ summary: '手动刷新持仓市值', description: '立即投递持仓市值刷新任务' })
  @ApiResponse({ status: 201, description: '任务投递成功' })
  async triggerPositionRefresh(@CurrentUser() user: { id: string }) {
    const job = await this.tradingQueue.add(
      'refresh-position-values',
      { triggered_by: user.id, manual: true },
      { removeOnComplete: true },
    );

    await this.operationLogService.logUserAction(
      user.id,
      OperationType.POSITION_REFRESH,
      'ops',
      '手动触发持仓刷新',
      { job_id: job.id },
    );

    return { message: 'Position refresh job queued', job_id: job.id };
  }

  @Post('create-snapshot')
  @ApiOperation({ summary: '手动生成资产快照', description: '立即投递资产分析快照任务' })
  @ApiResponse({ status: 201, description: '任务投递成功' })
  async triggerSnapshot(@CurrentUser() user: { id: string }) {
    const job = await this.dataSyncQueue.add(
      'create-snapshot',
      { triggered_by: user.id, manual: true },
      { removeOnComplete: true },
    );

    await this.operationLogService.logUserAction(
      user.id,
      OperationType.MANUAL_OPERATION,
      'ops',
      '手动触发资产快照生成',
      { job_id: job.id },
    );

    return { message: 'Snapshot job queued', job_id: job.id };
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
    description:
      '使用历史数据回测交易策略，计算收益率、夏普比率、最大回撤等指标，结果自动保存到数据库',
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

export { RiskController } from './risk.controller';
export { AnalyticsController } from './analytics.controller';
export { LogController } from './log.controller';
