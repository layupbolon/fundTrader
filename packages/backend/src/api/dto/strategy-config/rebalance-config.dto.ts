import {
  IsNumber,
  IsString,
  IsEnum,
  Min,
  Max,
  Matches,
  ValidateNested,
  ArrayMinSize,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvestFrequency } from '../../../models';

export class TargetAllocationDto {
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'fund_code must be a 6-digit number' })
  fund_code: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  target_weight: number;
}

@ValidatorConstraint({ name: 'weightsSumToOne', async: false })
class WeightsSumToOne implements ValidatorConstraintInterface {
  validate(_value: any, args: ValidationArguments): boolean {
    const obj = args.object as RebalanceConfigDto;
    if (!obj.target_allocations || obj.target_allocations.length === 0) {
      return false;
    }
    const sum = obj.target_allocations.reduce((s, a) => s + a.target_weight, 0);
    return Math.abs(sum - 1.0) <= 0.001;
  }

  defaultMessage(): string {
    return 'target_allocations weights must sum to 1.0 (±0.001 tolerance)';
  }
}

export class RebalanceConfigDto {
  @ValidateNested({ each: true })
  @Type(() => TargetAllocationDto)
  @ArrayMinSize(2)
  @Validate(WeightsSumToOne)
  target_allocations: TargetAllocationDto[];

  @IsNumber()
  @Min(0.01)
  @Max(0.5)
  rebalance_threshold: number;

  @IsEnum(InvestFrequency)
  frequency: InvestFrequency;
}
