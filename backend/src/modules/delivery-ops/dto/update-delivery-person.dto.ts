import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateDeliveryPersonDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

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

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
