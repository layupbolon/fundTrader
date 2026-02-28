import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Position, FundNav } from '../../models';

@Injectable()
export class PositionService {
  constructor(
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(FundNav)
    private fundNavRepository: Repository<FundNav>,
  ) {}

  /**
   * 买入确认后更新持仓
   *
   * 增加份额和成本，重新计算加权平均成本。
   * 如果持仓不存在则自动创建。
   */
  async updatePositionOnBuy(
    userId: string,
    fundCode: string,
    confirmedShares: number,
    confirmedPrice: number,
  ): Promise<Position> {
    const shares = Number(confirmedShares);
    const price = Number(confirmedPrice);
    const buyAmount = shares * price;

    let position = await this.positionRepository.findOne({
      where: { user_id: userId, fund_code: fundCode },
    });

    if (!position) {
      position = this.positionRepository.create({
        user_id: userId,
        fund_code: fundCode,
        shares: 0,
        cost: 0,
        avg_price: 0,
        current_value: 0,
        profit: 0,
        profit_rate: 0,
        max_profit_rate: 0,
      });
    }

    const currentShares = Number(position.shares);
    const currentCost = Number(position.cost);

    const newShares = currentShares + shares;
    const newCost = currentCost + buyAmount;
    const newAvgPrice = newShares > 0 ? newCost / newShares : 0;

    return this.positionRepository.save({
      ...position,
      shares: newShares,
      cost: newCost,
      avg_price: newAvgPrice,
    });
  }

  /**
   * 卖出确认后更新持仓
   *
   * 减少份额，按原始平均成本比例减少成本。
   */
  async updatePositionOnSell(
    userId: string,
    fundCode: string,
    confirmedShares: number,
    _confirmedPrice: number,
  ): Promise<Position> {
    const sellShares = Number(confirmedShares);

    const position = await this.positionRepository.findOne({
      where: { user_id: userId, fund_code: fundCode },
    });

    if (!position) {
      throw new Error(`Position not found for user ${userId} fund ${fundCode}`);
    }

    const currentShares = Number(position.shares);
    const currentCost = Number(position.cost);
    const currentAvgPrice = Number(position.avg_price);

    const sellCost = sellShares * currentAvgPrice;
    const newShares = currentShares - sellShares;
    const newCost = currentCost - sellCost;

    if (newShares <= 0) {
      return this.positionRepository.save({
        ...position,
        shares: 0,
        cost: 0,
        avg_price: 0,
      });
    }

    return this.positionRepository.save({
      ...position,
      shares: newShares,
      cost: newCost,
      avg_price: newCost / newShares,
    });
  }

  /**
   * 用最新净值刷新所有持仓的市值和收益率
   *
   * 查询所有 shares > 0 的持仓，获取每只基金最新 NAV，
   * 重新计算 current_value、profit、profit_rate，并更新 max_profit_rate。
   */
  async refreshAllPositionValues(): Promise<void> {
    const positions = await this.positionRepository.find({
      where: { shares: MoreThan(0) },
    });

    for (const position of positions) {
      const latestNav = await this.fundNavRepository.findOne({
        where: { fund_code: position.fund_code },
        order: { date: 'DESC' },
      });

      if (!latestNav) {
        continue;
      }

      const shares = Number(position.shares);
      const cost = Number(position.cost);
      const nav = Number(latestNav.nav);
      const currentMaxProfitRate = Number(position.max_profit_rate) || 0;

      const currentValue = shares * nav;
      const profit = currentValue - cost;
      const profitRate = cost > 0 ? profit / cost : 0;
      const maxProfitRate = profitRate > currentMaxProfitRate ? profitRate : currentMaxProfitRate;

      await this.positionRepository.save({
        ...position,
        current_value: currentValue,
        profit,
        profit_rate: profitRate,
        max_profit_rate: maxProfitRate,
      });
    }
  }
}
