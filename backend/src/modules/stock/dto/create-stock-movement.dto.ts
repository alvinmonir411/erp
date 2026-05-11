import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { StockMovementType } from '../stock.constants';

export class CreateStockMovementDto {
  @IsNumber()
  productId: number;

  @IsNumber()
  companyId: number;

  @IsEnum(StockMovementType)
  type: StockMovementType;

  @IsNumber()
  quantity: number;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @IsNumber()
  @IsOptional()
  balanceAfter?: number;
}
