import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Strategy, Position, StrategyType } from '../models';
import { AutoInvestStrategy } from '../core/strategy/auto-invest.strategy';
import { TakeProfitStopLossStrategy } from '../core/strategy/take-profit-stop-loss.strategy';
import { TiantianBrokerService } from '../services/broker/tiantian.service';

@Processor('trading')
@Injectable()
export class TradingProcessor {
  constructor(
    @InjectRepository(Strategy)
    private strategyRepository: Repository<Strategy>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    private autoInvestStrategy: AutoInvestStrategy,
    private takeProfitStopLossStrategy: TakeProfitStopLossStrategy,
    private brokerService: TiantianBrokerService,
  ) {}

  @Process('check-auto-invest')
  async handleAutoInvest(job: Job) {
    console.log('Checking auto-invest strategies...');

    const strategies = await this.strategyRepository.find({
      where: { type: StrategyType.AUTO_INVEST, enabled: true },
    });

    for (const strategy of strategies) {
      try {
        if (await this.autoInvestStrategy.shouldExecute(strategy)) {
          await this.autoInvestStrategy.execute(strategy);
        }
      } catch (error) {
        console.error(`Failed to execute auto-invest for strategy ${strategy.id}:`, error);
      }
    }
  }

  @Process('check-take-profit-stop-loss')
  async handleTakeProfitStopLoss(job: Job) {
    console.log('Checking take-profit and stop-loss...');

    const positions = await this.positionRepository.find({
      relations: ['user'],
    });

    for (const position of positions) {
      try {
        // 获取该持仓的止盈止损策略
        const takeProfitStrategies = await this.strategyRepository.find({
          where: {
            user_id: position.user_id,
            fund_code: position.fund_code,
            type: StrategyType.TAKE_PROFIT,
            enabled: true,
          },
        });

        const stopLossStrategies = await this.strategyRepository.find({
          where: {
            user_id: position.user_id,
            fund_code: position.fund_code,
            type: StrategyType.STOP_LOSS,
            enabled: true,
          },
        });

        // 检查止盈
        for (const strategy of takeProfitStrategies) {
          if (await this.takeProfitStopLossStrategy.checkTakeProfit(position, strategy.config)) {
            await this.takeProfitStopLossStrategy.executeSell(
              position,
              strategy.config.sell_ratio,
              '止盈',
              strategy.id,
            );
          }
        }

        // 检查止损
        for (const strategy of stopLossStrategies) {
          if (await this.takeProfitStopLossStrategy.checkStopLoss(position, strategy.config)) {
            await this.takeProfitStopLossStrategy.executeSell(
              position,
              strategy.config.sell_ratio,
              '止损',
              strategy.id,
            );
          }
        }
      } catch (error) {
        console.error(`Failed to check take-profit/stop-loss for position ${position.id}:`, error);
      }
    }
  }

  @Process('keep-session-alive')
  async handleKeepSessionAlive(job: Job) {
    console.log('Keeping session alive...');

    try {
      await this.brokerService.keepAlive();
    } catch (error) {
      console.error('Failed to keep session alive:', error);
    }
  }
}
