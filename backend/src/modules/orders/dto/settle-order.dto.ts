import {
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

class SettleOrderItemDto {
  @IsNumber()
  productId: number;

  @IsNumber()
  returnedPaidQuantity: number;

  @IsNumber()
  returnedFreeQuantity: number;

  @IsNumber()
  damagedPaidQuantity: number;

  @IsNumber()
  damagedFreeQuantity: number;
}

class SettleOrderDueEntryDto {
  @IsNumber()
  shopId: number;

  @IsNumber()
  @IsOptional()
  productId?: number; // Reserved for future use, currently ignored by backend

  @IsNumber()
  amount: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class SettleOrderDto {
  @ValidateNested({ each: true })
  @Type(() => SettleOrderItemDto)
  items: SettleOrderItemDto[];

  @IsNumber()
  @IsOptional()
  collectedAmount?: number;

  @IsString()
  @IsOptional()
  settlementNote?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SettleOrderDueEntryDto)
  dueEntries?: SettleOrderDueEntryDto[];
}
