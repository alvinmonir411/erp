import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ValidateUserDto {
  @IsString({ message: 'Email or username must be a valid string.' })
  @IsNotEmpty({ message: 'Please enter your email or username.' })
  identifier: string;

  @IsString({ message: 'Password must be a valid string.' })
  @MinLength(6, { message: 'Password must be at least 6 characters.' })
  password: string;
}
