import { randomUUID } from 'node:crypto';
import { select, update } from '@evershop/postgres-query-builder';
import { pool } from '@evershop/evershop/lib/postgres';
import { buildUrl } from '@evershop/evershop/lib/router';
import { error } from '@evershop/evershop/lib/log';
import { getConfig } from '@evershop/evershop/lib/util/getConfig';
import {
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  INVALID_PAYLOAD,
  OK,
  UNAUTHORIZED
} from '@evershop/evershop/lib/util/httpStatus';
import { YookassaService } from '../../services/yookassa/YookassaService.js';
import {
  getCurrentCustomerFromRequest,
  joinUrl,
  orderBelongsToCustomer,
  resolveStoreHomeUrl,
  toYookassaAmount
} from '../../services/yookassa/orderHelpers.js';
import { syncOrderPaymentWithYookassa } from '../../services/yookassa/paymentSync.js';

const buildResponseData = ({
  paymentId,
  status,
  confirmationUrl,
  redirectUrl
}: {
  paymentId: string;
  status: string;
  confirmationUrl?: string | null;
  redirectUrl?: string;
}) => ({
  paymentId,
  status,
  confirmationUrl: confirmationUrl || null,
  redirectUrl: redirectUrl || null
});

export default async (request, response, next) => {
  try {
    const orderUuid = String(request.body?.order_id || '').trim();
    if (!orderUuid) {
      response.status(INVALID_PAYLOAD);
      response.json({
        error: {
          status: INVALID_PAYLOAD,
          message: 'order_id is required'
        }
      });
      return;
    }

    const currentCustomer = getCurrentCustomerFromRequest(request);
    if (!currentCustomer) {
      response.status(UNAUTHORIZED);
      response.json({
        error: {
          status: UNAUTHORIZED,
          message: 'Authentication required'
        }
      });
      return;
    }

    const order = await select()
      .from('order')
      .where('uuid', '=', orderUuid)
      .and('payment_method', '=', 'yookassa_sbp')
      .and('payment_status', '=', 'pending')
      .load(pool);

    if (!order) {
      response.status(INVALID_PAYLOAD);
      response.json({
        error: {
          status: INVALID_PAYLOAD,
          message: 'Invalid order for YooKassa payment'
        }
      });
      return;
    }

    if (!orderBelongsToCustomer(order, currentCustomer)) {
      response.status(FORBIDDEN);
      response.json({
        error: {
          status: FORBIDDEN,
          message: 'Access denied'
        }
      });
      return;
    }

    const checkoutSuccessUrl = `${buildUrl('checkoutSuccess')}/${order.uuid}`;
    const yookassaService = YookassaService.getInstance();

    // Reuse existing pending payment when possible to prevent duplicates.
    if (order.integration_order_id) {
      const existingPayment = await yookassaService.getPayment(
        String(order.integration_order_id)
      );
      const existingPaymentStatus = String(
        existingPayment.status || ''
      ).toLowerCase();

      // If previous payment was canceled, create a new one without moving
      // order to failed in this request.
      if (existingPaymentStatus !== 'canceled') {
        const syncedStatus = await syncOrderPaymentWithYookassa(
          order,
          existingPayment
        );

        if (syncedStatus === 'paid') {
          response.status(OK);
          response.$body = {
            data: buildResponseData({
              paymentId: existingPayment.id,
              status: existingPayment.status,
              redirectUrl: checkoutSuccessUrl
            })
          };
          return next();
        }

        if (syncedStatus === 'pending') {
          const existingConfirmationUrl =
            existingPayment.confirmation?.confirmation_url || '';
          if (existingConfirmationUrl) {
            response.status(OK);
            response.$body = {
              data: buildResponseData({
                paymentId: existingPayment.id,
                status: existingPayment.status,
                confirmationUrl: existingConfirmationUrl
              })
            };
            return next();
          }
        }
      }
    }

    const amount = toYookassaAmount(order.grand_total);
    if (parseFloat(amount) <= 0) {
      response.status(INVALID_PAYLOAD);
      response.json({
        error: {
          status: INVALID_PAYLOAD,
          message: 'Order amount must be greater than zero'
        }
      });
      return;
    }

    const returnUrl = joinUrl(
      resolveStoreHomeUrl(),
      buildUrl('yookassaReturn', { order_id: order.uuid })
    );

    const configuredPaymentMethodType = String(
      getConfig('system.yookassa.paymentMethodType', '')
    )
      .trim()
      .toLowerCase();
    const isDevelopment =
      String(process.env.NODE_ENV || '').toLowerCase() === 'development';
    const paymentMethodType =
      configuredPaymentMethodType ||
      (isDevelopment ? 'bank_card' : 'sbp');

    const payment = await yookassaService.createPayment(
      {
        amount: {
          value: amount,
          currency: String(order.currency || 'RUB')
        },
        capture: true,
        description: `Order #${order.order_number}`,
        payment_method_data: {
          type: paymentMethodType
        },
        confirmation: {
          type: 'redirect',
          return_url: returnUrl
        },
        metadata: {
          order_id: order.uuid,
          order_number: String(order.order_number || '')
        }
      },
      randomUUID()
    );

    if (String(order.integration_order_id || '') !== payment.id) {
      await update('order')
        .given({ integration_order_id: payment.id })
        .where('order_id', '=', order.order_id)
        .execute(pool);
    }

    const syncedStatus = await syncOrderPaymentWithYookassa(order, payment);

    if (syncedStatus === 'paid') {
      response.status(OK);
      response.$body = {
        data: buildResponseData({
          paymentId: payment.id,
          status: payment.status,
          redirectUrl: checkoutSuccessUrl
        })
      };
      return next();
    }

    const confirmationUrl = payment.confirmation?.confirmation_url || '';
    if (!confirmationUrl) {
      response.status(INTERNAL_SERVER_ERROR);
      response.json({
        error: {
          status: INTERNAL_SERVER_ERROR,
          message: 'YooKassa did not return confirmation_url'
        }
      });
      return;
    }

    response.status(OK);
    response.$body = {
      data: buildResponseData({
        paymentId: payment.id,
        status: payment.status,
        confirmationUrl
      })
    };
    return next();
  } catch (e) {
    error(e);
    response.status(INTERNAL_SERVER_ERROR);
    response.json({
      error: {
        status: INTERNAL_SERVER_ERROR,
        message: e.message || 'Failed to create YooKassa payment'
      }
    });
  }
};
