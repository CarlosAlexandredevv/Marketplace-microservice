import {
  BadGatewayException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError } from 'axios';
import { of, throwError } from 'rxjs';
import { ProductsClientService } from './products-client.service';

describe('ProductsClientService', () => {
  let service: ProductsClientService;
  const httpService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsClientService,
        { provide: HttpService, useValue: httpService },
      ],
    }).compile();

    service = module.get(ProductsClientService);
  });

  it('getProduct retorna dados do catálogo', async () => {
    const snapshot = {
      id: 'p1',
      name: 'X',
      price: '9.99',
      stock: 10,
      sellerId: 's1',
      isActive: true,
    };
    httpService.get.mockReturnValue(of({ data: snapshot }));

    const result = await service.getProduct('p1');

    expect(result).toEqual(snapshot);
    expect(httpService.get).toHaveBeenCalledWith('/products/p1');
  });

  it('getProduct lança NotFound quando catálogo retorna 404', async () => {
    const err = new AxiosError('nope');
    err.response = { status: 404 } as AxiosError['response'];
    httpService.get.mockReturnValue(throwError(() => err));

    await expect(service.getProduct('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getProduct lança ServiceUnavailable quando catálogo retorna 5xx', async () => {
    const err = new AxiosError('nope');
    err.response = { status: 503 } as AxiosError['response'];
    httpService.get.mockReturnValue(throwError(() => err));

    await expect(service.getProduct('p1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('getProduct lança BadGateway para outros erros HTTP', async () => {
    const err = new AxiosError('nope');
    err.response = { status: 400 } as AxiosError['response'];
    httpService.get.mockReturnValue(throwError(() => err));

    await expect(service.getProduct('p1')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
