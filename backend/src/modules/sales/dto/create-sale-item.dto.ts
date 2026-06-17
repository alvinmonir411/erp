import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsPositive,
  IsOptional,
  IsIn,
  Min,
  IsString,
} from 'class-validator';

export class CreateSaleItemDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  productId: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantity: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsString()
  @IsIn(['percentage', 'fixed'])
  discountType?: 'percentage' | 'fixed';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  freeQuantity?: number;
}
