import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SettleOrderItemDto {
  @IsNumber()
  productId: number;

  @IsNumber()
  returnedQuantity: number;

  @IsNumber()
  damagedQuantity: number;
}

class DispatchCollectionDto {
  @IsNumber()
  orderId: number;

  @IsNumber()
  collectedAmount: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SettleOrderItemDto)
  items?: SettleOrderItemDto[];

  @IsString()
  @IsOptional()
  paymentMode?: string;

  @IsString()
  @IsOptional()
  note?: string;
}

class DueEntryDto {
  @IsNumber()
  orderId: number;

  @IsNumber()
  amount: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class SettleDispatchBatchDto {
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DispatchCollectionDto)
  collections: DispatchCollectionDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DueEntryDto)
  dueEntries?: DueEntryDto[];

  @IsNumber()
  @IsOptional()
  actualCashReceived?: number;

  @IsString()
  @IsOptional()
  note?: string;
}
