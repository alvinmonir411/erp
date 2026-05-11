import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateDeliveryPersonDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  vehicleNo?: string;

  @IsString()
  @IsOptional()
  helperName?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
