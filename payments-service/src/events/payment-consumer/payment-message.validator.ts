import { PaymentOrderMessage } from '../payment-queue.interface';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePaymentOrderMessage(
  message: PaymentOrderMessage,
): ValidationResult {
  if (!message.orderId) {
    return { valid: false, error: 'Missing orderId in payment message' };
  }

  if (!message.userId) {
    return { valid: false, error: 'Missing userId in payment message' };
  }

  if (!message.amount || message.amount <= 0) {
    return { valid: false, error: 'Invalid amount in payment message' };
  }

  if (!message.paymentMethod) {
    return { valid: false, error: 'Missing paymentMethod in payment message' };
  }

  if (!message.items || message.items.length === 0) {
    return { valid: false, error: 'No items in payment message' };
  }

  return { valid: true };
}
