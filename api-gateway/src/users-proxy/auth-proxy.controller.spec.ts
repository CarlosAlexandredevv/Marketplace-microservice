import { Test, TestingModule } from '@nestjs/testing';
import { AuthProxyController } from './auth-proxy.controller';
import { ProxyService } from 'src/proxy/service/proxy.service';

describe('AuthProxyController', () => {
  let controller: AuthProxyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthProxyController],
      providers: [
        {
          provide: ProxyService,
          useValue: { proxyRequest: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<AuthProxyController>(AuthProxyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
