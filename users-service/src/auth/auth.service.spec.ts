import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as passwordUtil from '../common/password.util';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('../common/password.util', () => {
  const actual = jest.requireActual<typeof import('../common/password.util')>(
    '../common/password.util',
  );
  return {
    ...actual,
    comparePassword: jest.fn(),
  };
});

const comparePasswordMock = passwordUtil.comparePassword as jest.MockedFunction<
  typeof passwordUtil.comparePassword
>;

describe('AuthService', () => {
  let service: AuthService;
  const usersService = {
    existsByEmail: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
  };
  const jwtService = {
    signAsync: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('register cria usuário quando e-mail é novo', async () => {
    usersService.existsByEmail.mockResolvedValue(false);
    const created = {
      id: 'u1',
      email: 'a@b.com',
      password: 'hash',
      firstName: 'A',
      lastName: 'B',
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;
    usersService.create.mockResolvedValue(created);

    const result = await service.register({
      email: '  A@B.COM ',
      password: 'secret12',
      firstName: ' A ',
      lastName: ' B ',
      role: UserRole.BUYER,
    });

    expect(usersService.existsByEmail).toHaveBeenCalledWith('a@b.com');
    expect(usersService.create).toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'u1',
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
    });
  });

  it('register lança Conflict quando e-mail já existe', async () => {
    usersService.existsByEmail.mockResolvedValue(true);

    await expect(
      service.register({
        email: 'x@y.com',
        password: 'secret12',
        firstName: 'X',
        lastName: 'Y',
        role: UserRole.BUYER,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('login retorna token e usuário público quando credenciais são válidas', async () => {
    const user = {
      id: 'u1',
      email: 'a@b.com',
      password: '$2a$10$hashed',
      firstName: 'A',
      lastName: 'B',
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;
    usersService.findByEmail.mockResolvedValue(user);
    comparePasswordMock.mockResolvedValue(true);
    jwtService.signAsync.mockResolvedValue('jwt-token');

    const result = await service.login({
      email: 'a@b.com',
      password: 'plain',
    });

    expect(result.token).toBe('jwt-token');
    expect(result.user.email).toBe('a@b.com');
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  });

  it('login lança Unauthorized quando senha é inválida', async () => {
    const user = {
      id: 'u1',
      email: 'a@b.com',
      password: 'hash',
      firstName: 'A',
      lastName: 'B',
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;
    usersService.findByEmail.mockResolvedValue(user);
    comparePasswordMock.mockResolvedValue(false);

    await expect(
      service.login({ email: 'a@b.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login lança Unauthorized quando usuário não existe', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.login({ email: 'nope@test.com', password: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login lança Unauthorized quando conta está inativa', async () => {
    const user = {
      id: 'u1',
      email: 'a@b.com',
      password: 'hash',
      firstName: 'A',
      lastName: 'B',
      role: UserRole.BUYER,
      status: UserStatus.INACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;
    usersService.findByEmail.mockResolvedValue(user);
    comparePasswordMock.mockResolvedValue(true);

    await expect(
      service.login({ email: 'a@b.com', password: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
