export interface PaymentOrderMessage {
  orderId: string;
  userId: string;
  amount: number;
  items: {
    id?: string;
    productId: string;
    name?: string;
    description?: string;
    quantity: number;
    price: number;
  }[];
  paymentMethod: string;
  createdAt?: Date;
  metadata?: {
    service: string;
    timestamp: string;
  };
}
