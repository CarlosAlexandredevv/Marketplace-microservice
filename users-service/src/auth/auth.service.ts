import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from '../users/users.service';
import { User, UserStatus } from '../users/entities/user.entity';

export type PublicUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async register(dto: RegisterDto): Promise<PublicUser> {
    const email = this.normalizeEmail(dto.email);

    if (await this.usersService.existsByEmail(email)) {
      throw new ConflictException('Este e-mail já está em uso.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.usersService.create({
      email,
      password: passwordHash,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      role: dto.role,
      status: UserStatus.ACTIVE,
    });

    return this.toPublicUser(user);
  }
}
