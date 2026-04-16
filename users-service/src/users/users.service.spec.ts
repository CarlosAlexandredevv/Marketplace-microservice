import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  const usersRepository = {
    existsByEmail: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findActiveSellers: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: usersRepository },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('getProfile retorna usuário público quando existe', async () => {
    const user = {
      id: 'u1',
      email: 'a@b.com',
      password: 'x',
      firstName: 'A',
      lastName: 'B',
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;
    usersRepository.findById.mockResolvedValue(user);

    const result = await service.getProfile('u1');

    expect(result.email).toBe('a@b.com');
    expect(result).not.toHaveProperty('password');
  });

  it('getProfile lança NotFound quando usuário não existe', async () => {
    usersRepository.findById.mockResolvedValue(null);

    await expect(service.getProfile('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('listActiveSellers mapeia para usuários públicos', async () => {
    const sellers = [
      {
        id: 's1',
        email: 's@test.com',
        password: 'x',
        firstName: 'S',
        lastName: 'L',
        role: UserRole.SELLER,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as User[];
    usersRepository.findActiveSellers.mockResolvedValue(sellers);

    const result = await service.listActiveSellers();

    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('s@test.com');
  });
});
