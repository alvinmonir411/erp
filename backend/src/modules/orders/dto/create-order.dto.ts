import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DiscountType } from '../orders.constants';

class OrderItemDto {
  @IsNumber()
  productId: number;

  @IsNumber()
  quantity: number;

  @IsNumber()
  @IsOptional()
  freeQuantity?: number;

  @IsNumber()
  unitPrice: number;

  @IsEnum(DiscountType)
  @IsOptional()
  discountType?: DiscountType;

  @IsNumber()
  @IsOptional()
  discountValue?: number;
}

export class CreateOrderDto {
  @IsDateString()
  orderDate: string;

  @IsNumber()
  @IsOptional()
  companyId?: number;

  @IsNumber()
  routeId: number;

  @IsNumber()
  @IsOptional()
  shopId?: number;

  @IsNumber()
  @IsOptional()
  deliveryPersonId?: number;

  @IsString()
  @IsOptional()
  marketArea?: string;

  @IsEnum(DiscountType)
  @IsOptional()
  discountType?: DiscountType;

  @IsNumber()
  @IsOptional()
  discountValue?: number;

  @IsNumber()
  @IsOptional()
  advancePaid?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsString()
  @IsOptional()
  note?: string;
}
