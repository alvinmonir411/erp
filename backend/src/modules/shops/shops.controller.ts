import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateShopDto } from './dto/create-shop.dto';
import { QueryShopsDto } from './dto/query-shops.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { ShopsService } from './shops.service';

import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('shops')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @Post()
  create(@Body() createShopDto: CreateShopDto) {
    return this.shopsService.create(createShopDto);
  }

  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.SR)
  @Get()
  findAll(@Query() query: QueryShopsDto, @CurrentUser() user: any) {
    return this.shopsService.findAll(query, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.SR)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.shopsService.findOne(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.SR)
  @Get('route/:routeId')
  listByRoute(@Param('routeId', ParseIntPipe) routeId: number) {
    return this.shopsService.listByRoute(routeId);
  }

  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateShopDto: UpdateShopDto,
  ) {
    return this.shopsService.update(id, updateShopDto);
  }

  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @Patch(':id/deactivate')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.shopsService.deactivate(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.shopsService.remove(id);
  }
}
