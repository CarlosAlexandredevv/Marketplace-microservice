import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { CircuitBreakerService } from 'src/common/circuit-breaker/circuit-breaker.service';
import { CacheFallbackService } from 'src/common/fallback/cache.fallback';
import { DefaultFallbackService } from 'src/common/fallback/default.fallback';
import { RetryService } from 'src/common/retry/retry.service';
import { TimeoutService } from 'src/common/timeout/timeout.service';
import { ProxyService } from './proxy.service';

describe('ProxyService', () => {
  let service: ProxyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProxyService,
        { provide: HttpService, useValue: {} },
        {
          provide: CircuitBreakerService,
          useValue: { executeWithCircuitBreaker: jest.fn() },
        },
        { provide: CacheFallbackService, useValue: {} },
        { provide: DefaultFallbackService, useValue: {} },
        { provide: TimeoutService, useValue: {} },
        { provide: RetryService, useValue: {} },
      ],
    }).compile();

    service = module.get<ProxyService>(ProxyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
