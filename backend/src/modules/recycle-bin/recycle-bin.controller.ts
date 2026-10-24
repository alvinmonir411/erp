import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { RecycleBinService } from './recycle-bin.service';
import { QueryRecycleBinDto } from './dto/query-recycle-bin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('recycle-bin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecycleBinController {
  constructor(private readonly recycleBinService: RecycleBinService) {}

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get()
  findAll(@Query() query: QueryRecycleBinDto) {
    return this.recycleBinService.findAll(query);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('stats')
  getStats() {
    return this.recycleBinService.getStats();
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.recycleBinService.findOne(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('restore/:id')
  restore(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.recycleBinService.restore(id, user);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete(':id')
  purge(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.recycleBinService.purge(id, user);
  }
}
