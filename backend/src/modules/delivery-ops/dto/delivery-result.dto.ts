import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum DeliveryResultStatus {
  DRAFT = 'DRAFT',
  COMPLETED = 'COMPLETED',
}

export class DeliveryResultItemDto {
  @IsNumber()
  productId: number;

  @IsNumber()
  returnedPaidQty: number;

  @IsNumber()
  returnedFreeQty: number;

  @IsNumber()
  damagedPaidQty: number;

  @IsNumber()
  damagedFreeQty: number;

  @IsString()
  @IsOptional()
  returnReason?: string;

  @IsString()
  @IsOptional()
  damageReason?: string;
}

export class DeliveryResultDto {
  @IsEnum(DeliveryResultStatus)
  status: DeliveryResultStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryResultItemDto)
  items: DeliveryResultItemDto[];

  @IsNumber()
  cashCollected: number;

  @IsNumber()
  dueAmount: number;

  @IsString()
  @IsOptional()
  deliveryNote?: string;
}
