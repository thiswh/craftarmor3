import { Request, Response } from 'express';
import { select, update } from '@evershop/postgres-query-builder';
import { pool } from '@evershop/evershop/lib/postgres';
import { getConfig } from '@evershop/evershop/lib/util/getConfig';
import { getMyCart } from '@evershop/evershop/checkout/services';

export default async function clearCartShipping(
  request: Request,
  response: Response
) {
  try {
    const cartId = String(request.params.cart_id || '');
    if (!cartId) {
      response.statusCode = 400;
      response.$body = {
        success: false,
        message: 'Required param: cart_id'
      };
      return;
    }

    const cookieName = getConfig('system.session.cookieName', 'sid');
    const sessionId =
      request.signedCookies?.[cookieName] ?? request.cookies?.[cookieName];
    if (!sessionId) {
      response.statusCode = 401;
      response.$body = {
        success: false,
        message: 'Session is required'
      };
      return;
    }

    const sessionCart = await getMyCart(sessionId, undefined).catch(() => null);
    const sessionCartUuid =
      sessionCart && typeof (sessionCart as any).getData === 'function'
        ? String((sessionCart as any).getData('uuid') || '')
        : '';
    if (!sessionCart || !sessionCartUuid || sessionCartUuid !== cartId) {
      response.statusCode = 403;
      response.$body = {
        success: false,
        message: 'Access denied for this cart'
      };
      return;
    }

    const cart = await select()
      .from('cart')
      .where('uuid', '=', cartId)
      .and('status', '=', true)
      .load(pool);

    if (!cart) {
      response.statusCode = 404;
      response.$body = {
        success: false,
        message: 'Cart not found'
      };
      return;
    }

    await update('cart')
      .given({
        shipping_address_id: null,
        shipping_zone_id: null,
        shipping_method: null,
        shipping_method_name: null,
        shipping_fee_excl_tax: 0,
        shipping_fee_incl_tax: 0,
        shipping_tax_amount: 0
      })
      .where('cart_id', '=', cart.cart_id)
      .execute(pool);

    response.$body = { success: true };
  } catch (error: any) {
    console.error('[clearCartShipping] Error:', error);
    response.statusCode = 500;
    response.$body = {
      success: false,
      message: 'Internal server error',
      error: error.message
    };
  }
}
