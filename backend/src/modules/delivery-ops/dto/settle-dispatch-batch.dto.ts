import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DispatchCollectionDto {
  @IsNumber()
  orderId: number;

  @IsNumber()
  collectedAmount: number;

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

  @IsString()
  @IsOptional()
  note?: string;
}
