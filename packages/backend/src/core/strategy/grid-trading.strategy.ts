import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Strategy,
  Transaction,
  TransactionType,
  TransactionStatus,
} from '../../models';
import { TiantianBrokerService } from '../../services/broker/tiantian.service';
import { FundDataService } from '../../services/data/fund-data.service';
import { NotifyService } from '../../services/notify/notify.service';
import { isTradeTime } from '../../utils';

interface GridTradingConfig {
  price_high: number;
  price_low: number;
  grid_count: number;
  amount_per_grid: number;
  last_grid_level?: number;
}

@Injectable()
export class GridTradingStrategy {
  constructor(
    @InjectRepository(Strategy)
    private strategyRepository: Repository<Strategy>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private fundDataService: FundDataService,
    private brokerService: TiantianBrokerService,
    private notifyService: NotifyService,
  ) {}

  getGridLines(config: GridTradingConfig): number[] {
    const { price_low, price_high, grid_count } = config;
    const step = (price_high - price_low) / grid_count;
    const lines: number[] = [];
    for (let i = 0; i <= grid_count; i++) {
      lines.push(price_low + step * i);
    }
    return lines;
  }

  getCurrentGridLevel(nav: number, gridLines: number[]): number {
    for (let i = gridLines.length - 1; i >= 0; i--) {
      if (nav >= gridLines[i]) {
        return i;
      }
    }
    return 0;
  }

  async shouldExecute(strategy: Strategy): Promise<boolean> {
    if (!strategy.enabled) {
      return false;
    }

    if (!isTradeTime()) {
      return false;
    }

    const config = strategy.config as GridTradingConfig;
    const navRecord = await this.fundDataService.getFundNav(strategy.fund_code);
    if (!navRecord) {
      return false;
    }

    const currentNav = Number(navRecord.nav);
    if (currentNav < config.price_low || currentNav > config.price_high) {
      return false;
    }

    const gridLines = this.getGridLines(config);
    const currentLevel = this.getCurrentGridLevel(currentNav, gridLines);
    const lastLevel = config.last_grid_level;

    if (lastLevel === undefined || lastLevel === null) {
      return true;
    }

    return currentLevel !== lastLevel;
  }

  async execute(strategy: Strategy): Promise<Transaction | null> {
    const config = strategy.config as GridTradingConfig;

    if (!isTradeTime()) {
      throw new Error('非交易时间');
    }

    const navRecord = await this.fundDataService.getFundNav(strategy.fund_code);
    if (!navRecord) {
      throw new Error('无法获取基金净值');
    }

    const currentNav = Number(navRecord.nav);
    const gridLines = this.getGridLines(config);
    const currentLevel = this.getCurrentGridLevel(currentNav, gridLines);
    const lastLevel = config.last_grid_level;

    if (lastLevel !== undefined && lastLevel !== null && currentLevel === lastLevel) {
      return null;
    }

    try {
      let transaction: Transaction;

      if (lastLevel === undefined || lastLevel === null || currentLevel < lastLevel) {
        // NAV moved down → BUY
        const order = await this.brokerService.buyFund(strategy.fund_code, config.amount_per_grid);
        transaction = this.transactionRepository.create({
          user_id: strategy.user_id,
          fund_code: strategy.fund_code,
          type: TransactionType.BUY,
          amount: config.amount_per_grid,
          status: TransactionStatus.PENDING,
          order_id: order.id,
          strategy_id: strategy.id,
        });
      } else {
        // NAV moved up → SELL
        const sellShares = config.amount_per_grid / currentNav;
        const order = await this.brokerService.sellFund(strategy.fund_code, sellShares);
        transaction = this.transactionRepository.create({
          user_id: strategy.user_id,
          fund_code: strategy.fund_code,
          type: TransactionType.SELL,
          amount: config.amount_per_grid,
          shares: sellShares,
          status: TransactionStatus.PENDING,
          order_id: order.id,
          strategy_id: strategy.id,
        });
      }

      await this.transactionRepository.save(transaction);

      // Update last_grid_level in config
      const updatedConfig = { ...config, last_grid_level: currentLevel };
      await this.strategyRepository.save({
        ...strategy,
        config: updatedConfig,
        last_executed_at: new Date(),
      });

      const action = (lastLevel === undefined || lastLevel === null || currentLevel < lastLevel) ? '买入' : '卖出';
      await this.notifyService.send({
        title: '网格交易执行',
        content: `基金 ${strategy.fund_code} ${action} ${config.amount_per_grid} 元\n当前净值: ${currentNav}\n网格层级: ${lastLevel ?? 'N/A'} → ${currentLevel}`,
        level: 'info',
      });

      return transaction;
    } catch (error) {
      await this.notifyService.send({
        title: '网格交易执行失败',
        content: `基金 ${strategy.fund_code} 交易失败\n错误: ${error.message}`,
        level: 'error',
      });
      throw error;
    }
  }
}
