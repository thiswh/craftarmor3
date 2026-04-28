import { insert, select } from '@evershop/postgres-query-builder';
import { emit } from '@evershop/evershop/lib/event';
import { pool } from '@evershop/evershop/lib/postgres';
import { updatePaymentStatus } from '@evershop/evershop/oms/services';
import type { YookassaPayment } from './YookassaService.js';

const toNumber = (value: unknown): number => {
  const parsed = parseFloat(String(value ?? '0'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const asJsonText = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return '{}';
  }
};

const upsertOrderActivity = async (orderId: number, comment: string) => {
  await insert('order_activity')
    .given({
      order_activity_order_id: orderId,
      comment,
      customer_notified: 0
    })
    .execute(pool);
};

export const syncOrderPaymentWithYookassa = async (
  order: any,
  payment: YookassaPayment
): Promise<'pending' | 'paid' | 'failed'> => {
  const normalizedStatus = String(payment?.status || '').toLowerCase();
  const paymentId = String(payment?.id || '').trim();

  if (!paymentId) {
    return 'pending';
  }

  if (normalizedStatus === 'succeeded') {
    const existingTransaction = await select()
      .from('payment_transaction')
      .where('payment_transaction_order_id', '=', order.order_id)
      .and('transaction_id', '=', paymentId)
      .load(pool);

    if (String(order.payment_status || '') !== 'paid') {
      await updatePaymentStatus(order.order_id, 'paid');
    }

    if (!existingTransaction) {
      await insert('payment_transaction')
        .given({
          payment_transaction_order_id: order.order_id,
          transaction_id: paymentId,
          transaction_type: 'online',
          amount: toNumber(payment.amount?.value),
          payment_action: 'capture',
          additional_information: asJsonText(payment)
        })
        .execute(pool);

      await upsertOrderActivity(
        order.order_id,
        `YooKassa payment succeeded. Payment ID: ${paymentId}`
      );

      await emit('order_placed', { ...order });
    }

    return 'paid';
  }

  if (normalizedStatus === 'canceled') {
    if (String(order.payment_status || '') !== 'failed') {
      await updatePaymentStatus(order.order_id, 'failed');
      await upsertOrderActivity(
        order.order_id,
        `YooKassa payment canceled. Payment ID: ${paymentId}`
      );
    }
    return 'failed';
  }

  return 'pending';
};
