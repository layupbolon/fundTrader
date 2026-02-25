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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StrategyType } from '../models';

export class CreateStrategyDto {
  @ApiProperty({ description: '用户ID', example: 'user-uuid-123' })
  @IsString()
  user_id: string;

  @ApiProperty({ description: '策略名称', example: '沪深300定投' })
  @IsString()
  name: string;

  @ApiProperty({
    description: '策略类型',
    enum: StrategyType,
    example: StrategyType.AUTO_INVEST,
  })
  @IsEnum(StrategyType)
  type: StrategyType;

  @ApiProperty({ description: '基金代码（6位数字）', example: '110011' })
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'fund_code must be a 6-digit number' })
  fund_code: string;

  @ApiProperty({
    description: '策略配置参数',
    example: {
      amount: 1000,
      frequency: 'WEEKLY',
      day_of_week: 1,
    },
  })
  @IsObject()
  config: any;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class BacktestDto {
  @ApiProperty({ description: '基金代码（6位数字）', example: '110011' })
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'fund_code must be a 6-digit number' })
  fund_code: string;

  @ApiProperty({ description: '回测开始日期', example: '2023-01-01' })
  @IsDateString()
  start_date: string;

  @ApiProperty({ description: '回测结束日期', example: '2024-01-01' })
  @IsDateString()
  end_date: string;

  @ApiProperty({ description: '初始资金（元）', example: 10000, minimum: 0 })
  @IsNumber()
  @Min(0)
  initial_capital: number;

  @ApiProperty({
    description: '策略配置参数',
    example: {
      amount: 1000,
      frequency: 'WEEKLY',
      day_of_week: 1,
    },
  })
  @IsObject()
  strategy_config: any;
}
