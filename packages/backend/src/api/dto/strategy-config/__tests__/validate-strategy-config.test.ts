import { BadRequestException } from '@nestjs/common';
import { StrategyType } from '../../../../models';
import { validateStrategyConfig } from '../validate-strategy-config';

describe('validateStrategyConfig', () => {
  describe('AUTO_INVEST', () => {
    it('should pass valid daily config', async () => {
      await expect(
        validateStrategyConfig(StrategyType.AUTO_INVEST, {
          amount: 1000,
          frequency: 'DAILY',
        }),
      ).resolves.toBeUndefined();
    });

    it('should pass valid weekly config with day_of_week', async () => {
      await expect(
        validateStrategyConfig(StrategyType.AUTO_INVEST, {
          amount: 500,
          frequency: 'WEEKLY',
          day_of_week: 3,
        }),
      ).resolves.toBeUndefined();
    });

    it('should pass valid monthly config with day_of_month', async () => {
      await expect(
        validateStrategyConfig(StrategyType.AUTO_INVEST, {
          amount: 2000,
          frequency: 'MONTHLY',
          day_of_month: 15,
        }),
      ).resolves.toBeUndefined();
    });

    it('should reject amount less than 10', async () => {
      await expect(
        validateStrategyConfig(StrategyType.AUTO_INVEST, {
          amount: 5,
          frequency: 'DAILY',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid frequency', async () => {
      await expect(
        validateStrategyConfig(StrategyType.AUTO_INVEST, {
          amount: 1000,
          frequency: 'INVALID',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject missing amount', async () => {
      await expect(
        validateStrategyConfig(StrategyType.AUTO_INVEST, {
          frequency: 'DAILY',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('TAKE_PROFIT_STOP_LOSS', () => {
    const validConfig = {
      take_profit: {
        target_rate: 0.15,
        sell_ratio: 0.5,
        trailing_stop: 0.05,
      },
      stop_loss: {
        max_drawdown: -0.1,
        sell_ratio: 1.0,
      },
    };

    it('should pass valid TPSL config', async () => {
      await expect(
        validateStrategyConfig(StrategyType.TAKE_PROFIT_STOP_LOSS, validConfig),
      ).resolves.toBeUndefined();
    });

    it('should reject positive max_drawdown', async () => {
      await expect(
        validateStrategyConfig(StrategyType.TAKE_PROFIT_STOP_LOSS, {
          ...validConfig,
          stop_loss: { max_drawdown: 0.1, sell_ratio: 1.0 },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject sell_ratio greater than 1', async () => {
      await expect(
        validateStrategyConfig(StrategyType.TAKE_PROFIT_STOP_LOSS, {
          ...validConfig,
          take_profit: { target_rate: 0.15, sell_ratio: 1.5 },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject missing take_profit', async () => {
      await expect(
        validateStrategyConfig(StrategyType.TAKE_PROFIT_STOP_LOSS, {
          stop_loss: { max_drawdown: -0.1, sell_ratio: 1.0 },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('unknown type', () => {
    it('should reject unknown strategy type', async () => {
      await expect(
        validateStrategyConfig('UNKNOWN' as StrategyType, { foo: 'bar' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
