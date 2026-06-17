import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class ReceiveSalePaymentDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @Type(() => Date)
  @IsDate()
  paymentDate: Date;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  note?: string;
}
