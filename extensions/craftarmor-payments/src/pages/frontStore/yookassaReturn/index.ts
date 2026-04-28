import { select, update } from '@evershop/postgres-query-builder';
import { pool } from '@evershop/evershop/lib/postgres';
import { buildUrl } from '@evershop/evershop/lib/router';
import { error } from '@evershop/evershop/lib/log';
import { YookassaService } from '../../../services/yookassa/YookassaService.js';
import {
  getCurrentCustomerFromRequest,
  orderBelongsToCustomer
} from '../../../services/yookassa/orderHelpers.js';
import { syncOrderPaymentWithYookassa } from '../../../services/yookassa/paymentSync.js';

const addNotification = (request, message: string, type = 'info') => {
  const session = request?.session;
  if (!session) {
    return;
  }
  session.notifications = session.notifications || [];
  session.notifications.push({ message, type });
};

const redirect = (request, response, url: string, notice?: string, noticeType = 'info') => {
  if (notice) {
    addNotification(request, notice, noticeType);
    if (request.session?.save) {
      request.session.save(() => response.redirect(302, url));
      return;
    }
  }
  response.redirect(302, url);
};

export default async (request, response) => {
  try {
    const orderUuid = String(request.params?.order_id || '').trim();
    if (!orderUuid) {
      response.redirect(302, buildUrl('homepage'));
      return;
    }

    const order = await select()
      .from('order')
      .where('uuid', '=', orderUuid)
      .and('payment_method', '=', 'yookassa_sbp')
      .load(pool);

    if (!order) {
      response.redirect(302, buildUrl('homepage'));
      return;
    }

    const currentCustomer = getCurrentCustomerFromRequest(request);
    if (currentCustomer && !orderBelongsToCustomer(order, currentCustomer)) {
      response.redirect(302, buildUrl('homepage'));
      return;
    }

    if (!order.integration_order_id) {
      response.redirect(302, `${buildUrl('checkoutSuccess')}/${orderUuid}`);
      return;
    }

    const yookassaService = YookassaService.getInstance();
    const payment = await yookassaService.getPayment(
      String(order.integration_order_id)
    );

    if (String(order.integration_order_id || '') !== payment.id) {
      await update('order')
        .given({ integration_order_id: payment.id })
        .where('order_id', '=', order.order_id)
        .execute(pool);
    }

    const syncedStatus = await syncOrderPaymentWithYookassa(order, payment);
    const successUrl = `${buildUrl('checkoutSuccess')}/${orderUuid}`;

    if (syncedStatus === 'paid') {
      response.redirect(302, successUrl);
      return;
    }

    if (syncedStatus === 'failed') {
      redirect(
        request,
        response,
        successUrl,
        'Payment was canceled. You can retry payment later.',
        'warning'
      );
      return;
    }

    redirect(
      request,
      response,
      successUrl,
      'Payment is still being processed. We will update status automatically.',
      'info'
    );
  } catch (e) {
    error(e);
    response.redirect(302, buildUrl('homepage'));
  }
};
