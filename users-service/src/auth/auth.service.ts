import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  BCRYPT_ROUNDS,
  comparePassword,
  hashPassword,
} from '../common/password.util';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserStatus } from '../users/entities/user.entity';
import { PublicUser, toPublicUser } from '../users/public-user';
import { UsersService } from '../users/users.service';

export type { PublicUser };

export type LoginResult = {
  user: PublicUser;
  token: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async register(dto: RegisterDto): Promise<PublicUser> {
    const email = this.normalizeEmail(dto.email);

    if (await this.usersService.existsByEmail(email)) {
      throw new ConflictException('Este e-mail já está em uso.');
    }

    const passwordHash = await hashPassword(dto.password, BCRYPT_ROUNDS);

    const user = await this.usersService.create({
      email,
      password: passwordHash,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      role: dto.role,
      status: UserStatus.ACTIVE,
    });

    return toPublicUser(user);
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

    return { user: toPublicUser(user), token };
  }
}
