import { select, update } from '@evershop/postgres-query-builder';
import { pool } from '@evershop/evershop/lib/postgres';
import { error } from '@evershop/evershop/lib/log';
import {
  INTERNAL_SERVER_ERROR,
  OK
} from '@evershop/evershop/lib/util/httpStatus';
import { YookassaService } from '../../services/yookassa/YookassaService.js';
import { syncOrderPaymentWithYookassa } from '../../services/yookassa/paymentSync.js';

export default async (request, response, next) => {
  try {
    const incomingPaymentId = String(request.body?.object?.id || '').trim();
    if (!incomingPaymentId) {
      response.status(OK);
      response.$body = {
        received: true,
        ignored: true
      };
      return next();
    }

    const yookassaService = YookassaService.getInstance();
    const payment = await yookassaService.getPayment(incomingPaymentId);

    const metadataOrderUuid = String(payment.metadata?.order_id || '').trim();

    let order: any = null;
    if (metadataOrderUuid) {
      order = await select()
        .from('order')
        .where('uuid', '=', metadataOrderUuid)
        .load(pool);

      // Ignore stale webhook for old payment if order already points to a new
      // integration payment id.
      if (
        order &&
        String(order.integration_order_id || '').trim() &&
        String(order.integration_order_id || '').trim() !== payment.id
      ) {
        response.status(OK);
        response.$body = {
          received: true,
          ignored: true
        };
        return next();
      }
    }

    if (!order) {
      order = await select()
        .from('order')
        .where('integration_order_id', '=', payment.id)
        .load(pool);
    }

    if (!order || String(order.payment_method) !== 'yookassa_sbp') {
      response.status(OK);
      response.$body = {
        received: true,
        ignored: true
      };
      return next();
    }

    if (!String(order.integration_order_id || '').trim()) {
      await update('order')
        .given({ integration_order_id: payment.id })
        .where('order_id', '=', order.order_id)
        .execute(pool);
    }

    const syncedStatus = await syncOrderPaymentWithYookassa(order, payment);

    response.status(OK);
    response.$body = {
      received: true,
      status: syncedStatus
    };
    return next();
  } catch (e) {
    error(e);
    response.status(INTERNAL_SERVER_ERROR);
    response.json({
      error: {
        status: INTERNAL_SERVER_ERROR,
        message: e.message || 'YooKassa webhook processing failed'
      }
    });
  }
};
