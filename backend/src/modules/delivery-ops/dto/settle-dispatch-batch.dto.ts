import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
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

  @IsNumber()
  @IsOptional()
  shopId?: number;

  @IsNumber()
  @IsOptional()
  productId?: number; // Reserved for future use, currently ignored by backend

  @IsString()
  @IsOptional()
  note?: string;
}

class DispatchExpenseItemDto {
  @IsString()
  @IsOptional()
  expenseType?: string;

  @IsString()
  name: string;

  @IsNumber()
  @Type(() => Number)
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
  @Type(() => Number)
  vanRent?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  salary?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DispatchExpenseItemDto)
  customExpenses?: DispatchExpenseItemDto[];

  @IsNumber()
  @Type(() => Number)
  actualCashReceived: number;

  @IsString()
  @IsOptional()
  note?: string;
}
