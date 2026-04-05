import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus } from './entities/user.entity';

export type CreateUserInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
};

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly ormRepository: Repository<User>,
  ) {}

  async existsByEmail(normalizedEmail: string): Promise<boolean> {
    const found = await this.ormRepository.findOne({
      where: { email: normalizedEmail },
    });
    return found !== null;
  }

  async findByEmail(normalizedEmail: string): Promise<User | null> {
    return this.ormRepository.findOne({
      where: { email: normalizedEmail },
    });
  }

  async create(data: CreateUserInput): Promise<User> {
    const user = this.ormRepository.create(data);
    return this.ormRepository.save(user);
  }
}
