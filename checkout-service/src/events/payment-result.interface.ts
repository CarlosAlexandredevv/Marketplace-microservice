export interface PaymentResultMessage {
  orderId: string;
  userId: string;
  status: 'approved' | 'rejected';
}
