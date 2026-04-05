import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from './entities/user.entity';
import { PublicUser, toPublicUser } from './public-user';
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

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return toPublicUser(user);
  }

  async listActiveSellers(): Promise<PublicUser[]> {
    const users = await this.usersRepository.findActiveSellers();
    return users.map(toPublicUser);
  }

  async getByIdOrThrow(id: string): Promise<PublicUser> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return toPublicUser(user);
  }
}
