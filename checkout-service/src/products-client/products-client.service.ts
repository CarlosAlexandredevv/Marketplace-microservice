import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios from 'axios';
import { firstValueFrom } from 'rxjs';
import { ProductSnapshot } from './product-snapshot';

@Injectable()
export class ProductsClientService {
  constructor(private readonly httpService: HttpService) {}

  async getProduct(productId: string): Promise<ProductSnapshot> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<ProductSnapshot>(`/products/${productId}`),
      );
      return data;
    } catch (err: unknown) {
      if (!axios.isAxiosError(err)) {
        throw err;
      }
      const status = err.response?.status;
      if (status === 404) {
        throw new NotFoundException('Produto não encontrado');
      }
      if (status !== undefined && status >= 500) {
        throw new ServiceUnavailableException(
          'Catálogo de produtos temporariamente indisponível',
        );
      }
      throw new BadGatewayException(
        'Falha ao consultar o catálogo de produtos',
      );
    }
  }
}
