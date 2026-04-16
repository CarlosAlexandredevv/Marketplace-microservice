import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from 'typeorm';

export enum CartStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
}

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('carts')
export class Cart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'text' })
  userId: string;

  @Column({ type: 'text', default: CartStatus.ACTIVE })
  status: CartStatus;

  @Column({
    name: 'total',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: '0',
  })
  total: string;

  @OneToMany(() => CartItem, (item) => item.cart, {
    cascade: true,
  })
  items: CartItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('cart_items')
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart: Cart;

  @RelationId((item: CartItem) => item.cart)
  cartId: string;

  @Column({ name: 'product_id', type: 'text' })
  productId: string;

  @Column({ name: 'product_name', length: 255 })
  productName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  orderId: string;

  @Column({ name: 'user_id', type: 'text' })
  userId: string;

  @Column({ name: 'cart_id', type: 'text' })
  cartId: string;

  @Column({ name: 'amount', type: 'decimal', precision: 10, scale: 2 })
  amount: string;

  @Column({ type: 'text', default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ name: 'payment_method', length: 50 })
  paymentMethod: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
