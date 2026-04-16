import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Cart } from '../cart/entities/cart.entity';
import { Order } from '../orders/entities/order.entity';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5436,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'checkout_db',
  entities: [Cart, CartItem, Order],
  synchronize: process.env.NODE_ENV !== 'production', // Apenas em dev
  logging: process.env.NODE_ENV === 'development',
};
