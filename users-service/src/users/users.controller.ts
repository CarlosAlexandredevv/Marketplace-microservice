import { Controller, Get, Param, ParseUUIDPipe, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtUser } from '../auth/jwt.strategy';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  profile(@Req() req: Request) {
    const user = req.user as JwtUser;
    return this.usersService.getProfile(user.id);
  }

  @Get('sellers')
  sellers() {
    return this.usersService.listActiveSellers();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getByIdOrThrow(id);
  }
}
