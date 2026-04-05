import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { JwtUser } from './jwt.strategy';
import { Public } from './public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login' })
  @ApiResponse({ status: 200, description: 'Token JWT e dados do utilizador' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registo' })
  @ApiResponse({ status: 201, description: 'Utilizador criado' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('validate-token')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Validar token JWT (uso interno / gateway)' })
  @ApiResponse({ status: 200, description: 'Identidade do token' })
  validateToken(@Req() req: Request) {
    const user = req.user as JwtUser;
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
