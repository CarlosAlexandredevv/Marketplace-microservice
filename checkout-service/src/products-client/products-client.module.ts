import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ProductsClientService } from './products-client.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const baseURL = configService.getOrThrow<string>(
          'PRODUCTS_SERVICE_URL',
        );
        return {
          baseURL: baseURL.replace(/\/+$/, ''),
          timeout: 10_000,
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [ProductsClientService],
  exports: [ProductsClientService],
})
export class ProductsClientModule {}
