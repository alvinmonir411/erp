import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateManualDamageDto {
  @IsNumber()
  productId: number;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsNumber()
  @IsOptional()
  companyId?: number;

  @IsNumber()
  @IsOptional()
  routeId?: number;

  @IsNumber()
  @IsOptional()
  shopId?: number;

  @IsString()
  @IsOptional()
  assignedDeliveryManId?: string;
}
