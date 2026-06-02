import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateManualDueDto {
  @IsString()
  shopId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsString()
  @Length(3, 200)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
