import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ProductsClientService } from '../products-client/products-client.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CartItemResponseDto } from './dto/cart-item-response.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { CartItem } from './entities/cart-item.entity';
import { Cart, CartStatus } from './entities/cart.entity';

function formatUnitPrice(price: string | number): string {
  const n = typeof price === 'number' ? price : parseFloat(price);
  if (!Number.isFinite(n)) {
    throw new UnprocessableEntityException('Preço do produto inválido');
  }
  return n.toFixed(2);
}

function multiplyUnitByQty(unit: string, quantity: number): string {
  const u = parseFloat(unit);
  if (!Number.isFinite(u)) {
    throw new UnprocessableEntityException('Preço do produto inválido');
  }
  return (u * quantity).toFixed(2);
}

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    private readonly dataSource: DataSource,
    private readonly productsClient: ProductsClientService,
  ) {}

  async getActiveCartForUser(userId: string): Promise<CartResponseDto> {
    const cart = await this.cartRepository.findOne({
      where: { userId, status: CartStatus.ACTIVE },
      relations: ['items'],
    });
    if (!cart) {
      return this.emptyCartView(userId);
    }
    return this.toCartResponse(cart);
  }

  async addItem(userId: string, dto: AddCartItemDto): Promise<CartResponseDto> {
    const product = await this.productsClient.getProduct(dto.productId);
    if (!product.isActive) {
      throw new UnprocessableEntityException(
        'Produto inativo ou indisponível para compra',
      );
    }

    const unitPrice = formatUnitPrice(product.price);

    return this.dataSource.transaction(async (manager) => {
      const cartRepo = manager.getRepository(Cart);
      const itemRepo = manager.getRepository(CartItem);

      let cart = await cartRepo.findOne({
        where: { userId, status: CartStatus.ACTIVE },
        lock: { mode: 'pessimistic_write' },
      });

      if (!cart) {
        const created = cartRepo.create({
          userId,
          status: CartStatus.ACTIVE,
          total: '0.00',
          items: [],
        });
        await cartRepo.save(created);
        cart = await cartRepo.findOneOrFail({
          where: { id: created.id },
          lock: { mode: 'pessimistic_write' },
        });
      }

      const lineItems = await itemRepo.find({
        where: { cart: { id: cart.id } },
      });

      const existing = lineItems.find((i) => i.productId === dto.productId);

      if (existing) {
        existing.quantity += dto.quantity;
        existing.productName = product.name;
        existing.price = unitPrice;
        existing.subtotal = multiplyUnitByQty(unitPrice, existing.quantity);
        await itemRepo.save(existing);
      } else {
        const item = itemRepo.create({
          cart,
          productId: dto.productId,
          productName: product.name,
          price: unitPrice,
          quantity: dto.quantity,
          subtotal: multiplyUnitByQty(unitPrice, dto.quantity),
        });
        await itemRepo.save(item);
      }

      await this.recalculateCartTotal(manager, cart.id);

      const updatedCart = await cartRepo.findOneOrFail({
        where: { id: cart.id },
      });
      updatedCart.items = await itemRepo.find({
        where: { cart: { id: cart.id } },
      });
      return this.toCartResponse(updatedCart);
    });
  }

  async removeItem(userId: string, itemId: string): Promise<CartResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const itemRepo = manager.getRepository(CartItem);
      const cartRepo = manager.getRepository(Cart);

      const item = await itemRepo.findOne({
        where: { id: itemId },
        relations: ['cart'],
      });

      if (
        !item ||
        item.cart.userId !== userId ||
        item.cart.status !== CartStatus.ACTIVE
      ) {
        throw new NotFoundException('Item do carrinho não encontrado');
      }

      const cartId = item.cart.id;
      await itemRepo.remove(item);
      await this.recalculateCartTotal(manager, cartId);

      const cart = await cartRepo.findOneOrFail({
        where: { id: cartId },
        relations: ['items'],
      });
      return this.toCartResponse(cart);
    });
  }

  private emptyCartView(userId: string): CartResponseDto {
    return {
      id: null,
      userId,
      status: CartStatus.ACTIVE,
      total: '0.00',
      items: [],
    };
  }

  private async recalculateCartTotal(
    manager: EntityManager,
    cartId: string,
  ): Promise<void> {
    const itemRepo = manager.getRepository(CartItem);
    const cartRepo = manager.getRepository(Cart);
    const items = await itemRepo.find({
      where: { cart: { id: cartId } },
    });
    const sum = items.reduce((acc, i) => acc + parseFloat(i.subtotal), 0);
    const total = sum.toFixed(2);
    await cartRepo.update(cartId, { total });
  }

  private toCartResponse(cart: Cart): CartResponseDto {
    const sortedItems = [...(cart.items ?? [])].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const items: CartItemResponseDto[] = sortedItems.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      price: i.price,
      quantity: i.quantity,
      subtotal: i.subtotal,
      createdAt: i.createdAt,
    }));
    return {
      id: cart.id,
      userId: cart.userId,
      status: cart.status,
      total: cart.total,
      items,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }
}
