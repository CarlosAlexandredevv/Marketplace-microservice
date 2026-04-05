import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { SellerRoleGuard } from './seller-role.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret?.trim()) {
          throw new Error('JWT_SECRET is required and cannot be empty.');
        }
        return {
          secret: secret.trim(),
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [JwtStrategy, JwtAuthGuard, SellerRoleGuard],
  exports: [JwtModule, JwtAuthGuard, SellerRoleGuard],
})
export class AuthModule {}
