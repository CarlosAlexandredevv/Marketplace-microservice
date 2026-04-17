import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guards/auth.guard';
import { ProxyService } from 'src/proxy/service/proxy.service';

interface GatewayJwtUser {
  userId: string;
  email: string;
  role: string;
}

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UsersProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Perfil do utilizador (proxy para users-service)' })
  @ApiResponse({ status: 200, description: 'Perfil retornado com sucesso' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  profile(@Req() req: Request) {
    const user = req.user as GatewayJwtUser;
    const auth = req.headers.authorization;
    return this.proxyService.proxyRequest(
      'users',
      'get',
      '/users/profile',
      undefined,
      auth ? { Authorization: auth } : {},
      {
        userId: user.userId,
        email: user.email,
        role: user.role,
      },
    );
  }

  @Get('sellers')
  @ApiOperation({ summary: 'Sellers ativos (proxy para users-service)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de sellers ativos retornada',
  })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  sellers(@Req() req: Request) {
    const user = req.user as GatewayJwtUser;
    const auth = req.headers.authorization;
    return this.proxyService.proxyRequest(
      'users',
      'get',
      '/users/sellers',
      undefined,
      auth ? { Authorization: auth } : {},
      {
        userId: user.userId,
        email: user.email,
        role: user.role,
      },
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Utilizador por ID (proxy para users-service)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Usuário encontrado' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req.user as GatewayJwtUser;
    const auth = req.headers.authorization;
    return this.proxyService.proxyRequest(
      'users',
      'get',
      `/users/${id}`,
      undefined,
      auth ? { Authorization: auth } : {},
      {
        userId: user.userId,
        email: user.email,
        role: user.role,
      },
    );
  }
}
