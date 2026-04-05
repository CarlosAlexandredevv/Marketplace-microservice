import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
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

export type LoginResult = {
  user: PublicUser;
  token: string;
};

function hashPassword(plain: string, rounds: number): Promise<string> {
  return new Promise((resolve, reject) => {
    bcrypt.hash(plain, rounds, (err, hash) => {
      if (err) reject(err);
      else if (hash !== undefined) resolve(hash);
      else reject(new Error('bcrypt.hash returned no hash'));
    });
  });
}

function comparePassword(plain: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    bcrypt.compare(plain, hash, (err, same) => {
      if (err) reject(err);
      else resolve(same === true);
    });
  });
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

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

    const passwordHash = await hashPassword(dto.password, 10);

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

  async login(dto: LoginDto): Promise<LoginResult> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const passwordOk = await comparePassword(dto.password, user.password);
    if (!passwordOk) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Conta inativa');
    }

    const token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { user: this.toPublicUser(user), token };
  }
}
