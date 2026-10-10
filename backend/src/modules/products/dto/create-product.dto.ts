import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { ProductUnit } from '../entities/product-unit.enum';

export class CreateProductDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  companyId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  sku: string;

  @IsEnum(ProductUnit)
  unit: ProductUnit;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 5 })
  @IsPositive()
  buyPrice: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 5 })
  @IsPositive()
  salePrice: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
