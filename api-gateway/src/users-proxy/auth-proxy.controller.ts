import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from 'src/guards/auth.guard';
import { ProxyService } from 'src/proxy/service/proxy.service';
import { LoginDto } from 'src/auth/dtos/login.dto';
import { RegisterDto } from 'src/auth/dtos/register.dto';

interface GatewayJwtUser {
  userId: string;
  email: string;
  role: string;
}

interface UsersServiceLoginBody {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  token: string;
}

/** Corpo de resposta de registo no users-service (PublicUser). */
type RegisterResponse = UsersServiceLoginBody['user'];

@ApiTags('Authentication')
@Controller('auth')
export class AuthProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login do usuário',
    description: 'Autentica um usuário e retorna JWT e session token',
  })
  @ApiResponse({
    status: 200,
    description: 'Login realizado com sucesso',
    schema: {
      type: 'object',
      properties: {
        user: { type: 'object' },
        accessToken: {
          type: 'string',
          description: 'JWT para Authorization: Bearer',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async login(@Body() loginDto: LoginDto) {
    const data = await this.proxyService.proxyRequest<UsersServiceLoginBody>(
      'users',
      'post',
      '/auth/login',
      loginDto,
    );
    const { user, token } = data;
    return {
      accessToken: token,
      user,
    };
  }

  @Post('register')
  @ApiOperation({
    summary: 'Registro de usuário',
    description: 'Cria uma nova conta de usuário no sistema',
  })
  @ApiResponse({ status: 201, description: 'Usuário registrado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 409, description: 'Email já cadastrado' })
  @Throttle({ medium: { limit: 3, ttl: 60000 } })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const created = await this.proxyService.proxyRequest<RegisterResponse>(
      'users',
      'post',
      '/auth/register',
      registerDto,
    );
    res.status(HttpStatus.CREATED);
    return created;
  }

  @Get('validate-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Validar token JWT (proxy users-service)' })
  @ApiResponse({ status: 200, description: 'Identidade do token' })
  async validateToken(@Req() req: Request) {
    const user = req.user as GatewayJwtUser;
    const auth = req.headers.authorization;
    return this.proxyService.proxyRequest(
      'users',
      'get',
      '/auth/validate-token',
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
