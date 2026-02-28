import { IsNumber, Min, Max, Validate, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';

@ValidatorConstraint({ name: 'priceHighGreaterThanLow', async: false })
class PriceHighGreaterThanLow implements ValidatorConstraintInterface {
  validate(_value: any, args: ValidationArguments): boolean {
    const obj = args.object as GridTradingConfigDto;
    return obj.price_high > obj.price_low;
  }

  defaultMessage(): string {
    return 'price_high must be greater than price_low';
  }
}

export class GridTradingConfigDto {
  @IsNumber()
  @Min(0)
  @Validate(PriceHighGreaterThanLow)
  price_high: number;

  @IsNumber()
  @Min(0)
  price_low: number;

  @IsNumber()
  @Min(2)
  @Max(100)
  grid_count: number;

  @IsNumber()
  @Min(10)
  amount_per_grid: number;
}
