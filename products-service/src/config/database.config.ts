import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const useE2eSqlite = process.env.PRODUCTS_E2E_SQLITE === '1';

export const databaseConfig: TypeOrmModuleOptions = useE2eSqlite
  ? {
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: true,
      logging: false,
    }
  : {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5436,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'products_db',
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
    };
