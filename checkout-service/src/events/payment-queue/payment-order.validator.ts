import type { PaymentOrderMessage } from '../payment-queue.interface';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePaymentOrder(
  paymentOrder: PaymentOrderMessage,
): ValidationResult {
  const errors: string[] = [];

  if (!paymentOrder.orderId) {
    errors.push('missing orderId');
  }

  if (!paymentOrder.userId) {
    errors.push('missing userId');
  }

  if (!paymentOrder.amount || paymentOrder.amount <= 0) {
    errors.push('invalid amount');
  }

  if (!paymentOrder.items || paymentOrder.items.length === 0) {
    errors.push('no items');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
