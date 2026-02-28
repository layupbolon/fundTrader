import {
  IsNumber,
  IsOptional,
  IsDefined,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TakeProfitPartDto {
  @IsNumber()
  @Min(0)
  target_rate: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  sell_ratio: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  trailing_stop?: number;
}

export class StopLossPartDto {
  @IsNumber()
  @Max(0)
  max_drawdown: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  sell_ratio: number;
}

export class TakeProfitStopLossConfigDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => TakeProfitPartDto)
  take_profit: TakeProfitPartDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => StopLossPartDto)
  stop_loss: StopLossPartDto;
}
