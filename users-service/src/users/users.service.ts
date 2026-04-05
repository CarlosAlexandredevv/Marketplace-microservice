import { Injectable } from '@nestjs/common';
import { User } from './entities/user.entity';
import { CreateUserInput, UsersRepository } from './users.repository';

export type { CreateUserInput } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async existsByEmail(normalizedEmail: string): Promise<boolean> {
    return this.usersRepository.existsByEmail(normalizedEmail);
  }

  async findByEmail(normalizedEmail: string): Promise<User | null> {
    return this.usersRepository.findByEmail(normalizedEmail);
  }

  async create(data: CreateUserInput): Promise<User> {
    return this.usersRepository.create(data);
  }
}
