import { Controller, Get, Param, ParseUUIDPipe, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { JwtUser } from '../auth/jwt.strategy';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('bearer')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Perfil do utilizador autenticado' })
  profile(@Req() req: Request) {
    const user = req.user as JwtUser;
    return this.usersService.getProfile(user.id);
  }

  @Get('sellers')
  @ApiOperation({ summary: 'Lista de sellers ativos' })
  sellers() {
    return this.usersService.listActiveSellers();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Utilizador por ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getByIdOrThrow(id);
  }
}
