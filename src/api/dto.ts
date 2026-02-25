import {
  IsString,
  IsNumber,
  IsDateString,
  IsObject,
  Min,
  Matches,
  IsEnum,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { StrategyType, InvestFrequency } from '../models';

export class CreateStrategyDto {
  @IsString()
  user_id: string;

  @IsString()
  name: string;

  @IsEnum(StrategyType)
  type: StrategyType;

  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'fund_code must be a 6-digit number' })
  fund_code: string;

  @IsObject()
  config: any;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class BacktestDto {
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'fund_code must be a 6-digit number' })
  fund_code: string;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsNumber()
  @Min(0)
  initial_capital: number;

  @IsObject()
  strategy_config: any;
}
