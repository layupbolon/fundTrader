import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { StrategyType } from '../../../models';
import { AutoInvestConfigDto } from './auto-invest-config.dto';
import { TakeProfitStopLossConfigDto } from './take-profit-config.dto';

const CONFIG_DTO_MAP: Record<string, new () => any> = {
  [StrategyType.AUTO_INVEST]: AutoInvestConfigDto,
  [StrategyType.TAKE_PROFIT]: TakeProfitStopLossConfigDto,
  [StrategyType.STOP_LOSS]: TakeProfitStopLossConfigDto,
};

export async function validateStrategyConfig(
  type: StrategyType,
  config: Record<string, any>,
): Promise<void> {
  const DtoClass = CONFIG_DTO_MAP[type];
  if (!DtoClass) {
    throw new BadRequestException(`Unknown strategy type: ${type}`);
  }

  const instance = plainToInstance(DtoClass, config);
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    const messages = errors.flatMap((e) =>
      Object.values(e.constraints || {})
    );
    throw new BadRequestException({
      message: 'Invalid strategy config',
      errors: messages,
    });
  }
}
