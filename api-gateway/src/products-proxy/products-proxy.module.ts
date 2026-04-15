import { Module } from '@nestjs/common';
import { ProxyModule } from 'src/proxy/proxy.module';
import { ProductsProxyController } from './products-proxy.controller';

@Module({
  imports: [ProxyModule],
  controllers: [ProductsProxyController],
})
export class ProductsProxyModule {}
