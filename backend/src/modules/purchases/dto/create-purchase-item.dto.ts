import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsPositive } from 'class-validator';

export class CreatePurchaseItemDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  productId: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantity: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 5 })
  @IsPositive()
  unitCost: number;
}
