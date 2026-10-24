import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryRecycleBinDto {
  @IsOptional()
  @IsString()
  entityType?: 'ALL' | 'ORDER' | 'DISPATCH_BATCH' | 'DUE';

  @IsOptional()
  @IsString()
  status?: 'ALL' | 'DELETED' | 'RESTORED';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}
