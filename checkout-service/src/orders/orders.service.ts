import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaymentQueueService } from '../events/payment-queue/payment-queue.service';
import type { PaymentOrderMessage } from '../events/payment-queue.interface';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Cart, CartStatus } from '../cart/entities/cart.entity';
import { CheckoutDto } from './dto/checkout.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { Order, OrderStatus } from './entities/order.entity';

function parseAmount(value: string): number {
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new UnprocessableEntityException('Total do carrinho inválido');
  }
  return n;
}

function toPaymentItems(items: CartItem[]): PaymentOrderMessage['items'] {
  return items.map((item) => {
    const price = parseFloat(item.price);
    if (!Number.isFinite(price)) {
      throw new UnprocessableEntityException(
        'Preço de item inválido no carrinho',
      );
    }
    return {
      productId: item.productId,
      quantity: item.quantity,
      price,
    };
  });
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly paymentQueueService: PaymentQueueService,
  ) {}

  async checkout(userId: string, dto: CheckoutDto): Promise<OrderResponseDto> {
    const { order: savedOrder, lineItems } = await this.dataSource.transaction(
      async (manager) => {
        const cartRepo = manager.getRepository(Cart);
        const orderRepo = manager.getRepository(Order);

        const cart = await cartRepo.findOne({
          where: { userId, status: CartStatus.ACTIVE },
          lock: { mode: 'pessimistic_write' },
        });

        if (!cart) {
          throw new UnprocessableEntityException(
            'Carrinho ativo inexistente ou sem itens para finalizar',
          );
        }

        const itemRepo = manager.getRepository(CartItem);
        const lineItems = await itemRepo.find({
          where: { cart: { id: cart.id } },
        });

        if (!lineItems.length) {
          throw new UnprocessableEntityException(
            'Carrinho ativo inexistente ou sem itens para finalizar',
          );
        }

        const order = orderRepo.create({
          userId,
          cartId: cart.id,
          amount: cart.total,
          paymentMethod: dto.paymentMethod,
          status: OrderStatus.PENDING,
        });
        const persisted = await orderRepo.save(order);

        cart.status = CartStatus.COMPLETED;
        await cartRepo.save(cart);

        return { order: persisted, lineItems: [...lineItems] };
      },
    );

    const amount = parseAmount(savedOrder.amount);
    const messageItems = toPaymentItems(lineItems);

    const message: PaymentOrderMessage = {
      orderId: savedOrder.orderId,
      userId: savedOrder.userId,
      amount,
      items: messageItems,
      paymentMethod: savedOrder.paymentMethod,
    };

    try {
      await this.paymentQueueService.publishPaymentOrderSafe(message);
    } catch {
      throw new ServiceUnavailableException(
        'Pedido criado, mas a fila de pagamento está indisponível. Tente novamente em instantes ou contate o suporte.',
      );
    }

    return this.toOrderResponse(savedOrder);
  }

  async findAllForUser(userId: string): Promise<OrderResponseDto[]> {
    const orders = await this.orderRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return orders.map((o) => this.toOrderResponse(o));
  }

  async findOneForUser(
    userId: string,
    orderId: string,
  ): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findOne({
      where: { orderId, userId },
    });
    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }
    return this.toOrderResponse(order);
  }

  private toOrderResponse(order: Order): OrderResponseDto {
    return {
      orderId: order.orderId,
      userId: order.userId,
      cartId: order.cartId,
      total: order.amount,
      status: order.status,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
