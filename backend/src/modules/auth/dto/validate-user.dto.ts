import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ValidateUserDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @MinLength(6)
  password: string;
}
