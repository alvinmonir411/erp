import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecordBatchReturnItemDto {
  @IsOptional()
  @IsNumber()
  orderItemId?: number;

  @IsNumber()
  productId: number;

  @IsOptional()
  @IsNumber()
  dispatchedQuantity?: number;

  @IsOptional()
  @IsNumber()
  returnedPaidQuantity?: number;

  @IsOptional()
  @IsNumber()
  returnedFreeQuantity?: number;

  @IsOptional()
  @IsNumber()
  damagedPaidQuantity?: number;

  @IsOptional()
  @IsNumber()
  damagedFreeQuantity?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class RecordBatchReturnOrderDto {
  @IsNumber()
  orderId: number;

  @IsOptional()
  @IsString()
  returnReason?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordBatchReturnItemDto)
  items: RecordBatchReturnItemDto[];
}

export class RecordBatchReturnsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordBatchReturnOrderDto)
  orders: RecordBatchReturnOrderDto[];

  @IsOptional()
  @IsString()
  note?: string;
}
