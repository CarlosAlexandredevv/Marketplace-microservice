/**
 * Entidade espelhada para SQLite E2E (colunas text em vez de enum nativo PG).
 * Carregada via jest.mock em jest-e2e-setup (somente testes E2E).
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  SELLER = 'seller',
  BUYER = 'buyer',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ name: 'first_name', length: 255 })
  firstName: string;

  @Column({ name: 'last_name', length: 255 })
  lastName: string;

  @Column({ type: 'text' })
  role: UserRole;

  @Column({ type: 'text', default: UserStatus.ACTIVE })
  status: UserStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
