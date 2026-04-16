import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from 'src/auth/auth.module';
import { JwtAuthGuard } from 'src/guards/auth.guard';
import { ProxyModule } from 'src/proxy/proxy.module';
import { PaymentsProxyController } from './payments-proxy.controller';

@Module({
  imports: [
    ProxyModule,
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [PaymentsProxyController],
  providers: [JwtAuthGuard],
})
export class PaymentsProxyModule {}
