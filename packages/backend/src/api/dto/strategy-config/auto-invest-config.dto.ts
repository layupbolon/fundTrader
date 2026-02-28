import {
  IsNumber,
  IsEnum,
  IsOptional,
  IsDateString,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { InvestFrequency } from '../../../models';

export class AutoInvestConfigDto {
  @IsNumber()
  @Min(10)
  amount: number;

  @IsEnum(InvestFrequency)
  frequency: InvestFrequency;

  @ValidateIf((o) => o.frequency === InvestFrequency.WEEKLY)
  @IsNumber()
  @Min(1)
  @Max(7)
  day_of_week?: number;

  @ValidateIf((o) => o.frequency === InvestFrequency.MONTHLY)
  @IsNumber()
  @Min(1)
  @Max(31)
  day_of_month?: number;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}
