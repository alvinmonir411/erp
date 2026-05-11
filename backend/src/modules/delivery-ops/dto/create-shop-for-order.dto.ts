import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateShopForOrderDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
// Trigger file watcher
