import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { ProductUnit } from '../entities/product-unit.enum';

export class UpdateProductDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  companyId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @IsOptional()
  @IsEnum(ProductUnit)
  unit?: ProductUnit;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 5 })
  @IsPositive()
  buyPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 5 })
  @IsPositive()
  salePrice?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
