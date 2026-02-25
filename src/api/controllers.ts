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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Strategy, Position, Transaction, Fund } from '../models';
import { BacktestEngine, BacktestResult } from '../core/backtest/backtest.engine';
import { CreateStrategyDto, BacktestDto } from './dto';

@Controller('strategies')
export class StrategyController {
  constructor(
    @InjectRepository(Strategy)
    private strategyRepository: Repository<Strategy>,
  ) {}

  @Get()
  async findAll(@Query('user_id') userId?: string) {
    const where = userId ? { user_id: userId } : {};
    return this.strategyRepository.find({ where, relations: ['fund'] });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.strategyRepository.findOne({
      where: { id },
      relations: ['fund', 'user'],
    });
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() createDto: CreateStrategyDto) {
    const strategy = this.strategyRepository.create(createDto);
    return this.strategyRepository.save(strategy);
  }

  @Post(':id/toggle')
  async toggle(@Param('id') id: string) {
    const strategy = await this.strategyRepository.findOne({ where: { id } });
    if (!strategy) {
      throw new Error('Strategy not found');
    }
    strategy.enabled = !strategy.enabled;
    return this.strategyRepository.save(strategy);
  }
}

@Controller('positions')
export class PositionController {
  constructor(
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
  ) {}

  @Get()
  async findAll(@Query('user_id') userId?: string) {
    const where = userId ? { user_id: userId } : {};
    return this.positionRepository.find({
      where,
      relations: ['fund', 'user'],
      order: { updated_at: 'DESC' },
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.positionRepository.findOne({
      where: { id },
      relations: ['fund', 'user'],
    });
  }
}

@Controller('transactions')
export class TransactionController {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  @Get()
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
  async findOne(@Param('id') id: string) {
    return this.transactionRepository.findOne({
      where: { id },
      relations: ['fund', 'strategy', 'user'],
    });
  }
}

@Controller('funds')
export class FundController {
  constructor(
    @InjectRepository(Fund)
    private fundRepository: Repository<Fund>,
  ) {}

  @Get()
  async findAll() {
    return this.fundRepository.find({
      order: { updated_at: 'DESC' },
    });
  }

  @Get(':code')
  async findOne(@Param('code') code: string) {
    return this.fundRepository.findOne({ where: { code } });
  }
}

@Controller('backtest')
export class BacktestController {
  constructor(private backtestEngine: BacktestEngine) {}

  @Post()
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
