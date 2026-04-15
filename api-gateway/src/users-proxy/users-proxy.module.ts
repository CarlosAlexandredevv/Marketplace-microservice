import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from 'src/guards/auth.guard';
import { ProxyModule } from 'src/proxy/proxy.module';
import { AuthModule } from 'src/auth/auth.module';
import { AuthProxyController } from './auth-proxy.controller';
import { UsersProxyController } from './users-proxy.controller';

@Module({
  imports: [
    ProxyModule,
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [AuthProxyController, UsersProxyController],
  providers: [JwtAuthGuard],
})
export class UsersProxyModule {}
