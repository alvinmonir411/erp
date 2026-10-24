import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecycleBinItem } from './entities/recycle-bin.entity';
import { RecycleBinService } from './recycle-bin.service';
import { RecycleBinController } from './recycle-bin.controller';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [TypeOrmModule.forFeature([RecycleBinItem]), RealtimeModule],
  controllers: [RecycleBinController],
  providers: [RecycleBinService],
  exports: [RecycleBinService],
})
export class RecycleBinModule {}
