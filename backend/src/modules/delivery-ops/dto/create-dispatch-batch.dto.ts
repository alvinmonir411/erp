import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateDispatchBatchDto {
  @IsDateString()
  dispatchDate: string;

  @IsNumber()
  @IsOptional()
  companyId?: number;

  @IsNumber()
  routeId: number;

  @IsNumber()
  @IsOptional()
  deliveryPersonId: number;

  @IsString()
  assignedDeliveryManId: string;

  @IsString()
  @IsOptional()
  marketArea?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  orderIds: number[];
}
