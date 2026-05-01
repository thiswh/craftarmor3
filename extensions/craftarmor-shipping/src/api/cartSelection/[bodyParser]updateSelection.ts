import { select } from '@evershop/postgres-query-builder';
import { pool } from '@evershop/evershop/lib/postgres';
import { getConfig } from '@evershop/evershop/lib/util/getConfig';
import { getMyCart } from '@evershop/evershop/checkout/services';
import {
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  INVALID_PAYLOAD,
  OK,
  UNAUTHORIZED
} from '@evershop/evershop/lib/util/httpStatus';

const parseBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true' || value === '1' || value === 1) {
    return true;
  }
  if (value === 'false' || value === '0' || value === 0) {
    return false;
  }
  return null;
};

const unique = <T>(items: T[]) => [...new Set(items)];

export default async (request, response, next) => {
  try {
    const cartUuid = String(request.params?.cart_id || '').trim();
    if (!cartUuid) {
      response.status(INVALID_PAYLOAD);
      return response.json({
        error: { status: INVALID_PAYLOAD, message: 'cart_id is required' }
      });
    }

    const selected = parseBoolean(request.body?.selected);
    if (selected === null) {
      response.status(INVALID_PAYLOAD);
      return response.json({
        error: { status: INVALID_PAYLOAD, message: 'selected must be boolean' }
      });
    }

    const selectAll = parseBoolean(request.body?.select_all) === true;
    const bodyItemIds = Array.isArray(request.body?.item_ids)
      ? request.body.item_ids
      : [];
    const oneItemId = request.body?.item_id ? [request.body.item_id] : [];
    const itemUuids = unique(
      [...bodyItemIds, ...oneItemId]
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    );

    if (!selectAll && itemUuids.length === 0) {
      response.status(INVALID_PAYLOAD);
      return response.json({
        error: {
          status: INVALID_PAYLOAD,
          message: 'item_ids or item_id is required when select_all is false'
        }
      });
    }

    const cookieName = getConfig('system.session.cookieName', 'sid');
    const sessionId =
      request.signedCookies?.[cookieName] ?? request.cookies?.[cookieName];
    if (!sessionId) {
      response.status(UNAUTHORIZED);
      return response.json({
        error: { status: UNAUTHORIZED, message: 'Session is required' }
      });
    }

    const currentCustomer =
      (typeof request.getCurrentCustomer === 'function'
        ? request.getCurrentCustomer()
        : null) ||
      request.currentCustomer ||
      request.locals?.customer ||
      null;
    const customerId = currentCustomer
      ? Number(
          currentCustomer.customer_id ??
            currentCustomer.customerId ??
            currentCustomer.id ??
            0
        ) || undefined
      : undefined;

    const sessionCart = await getMyCart(sessionId, customerId).catch(() => null);
    const sessionCartUuid =
      sessionCart && typeof (sessionCart as any).getData === 'function'
        ? String((sessionCart as any).getData('uuid') || '')
        : '';

    if (!sessionCart || !sessionCartUuid || sessionCartUuid !== cartUuid) {
      response.status(FORBIDDEN);
      return response.json({
        error: { status: FORBIDDEN, message: 'Access denied for this cart' }
      });
    }

    const cart = await select()
      .from('cart')
      .where('uuid', '=', cartUuid)
      .and('status', '=', true)
      .load(pool);

    if (!cart) {
      response.status(INVALID_PAYLOAD);
      return response.json({
        error: { status: INVALID_PAYLOAD, message: 'Cart not found' }
      });
    }

    let updatedCount = 0;
    if (selectAll) {
      const updateResult = await pool.query(
        `
          UPDATE cart_item
          SET is_selected = $1, updated_at = CURRENT_TIMESTAMP
          WHERE cart_id = $2
        `,
        [selected, cart.cart_id]
      );
      updatedCount = Number(updateResult.rowCount || 0);
    } else {
      const updateResult = await pool.query(
        `
          UPDATE cart_item
          SET is_selected = $1, updated_at = CURRENT_TIMESTAMP
          WHERE cart_id = $2
            AND uuid::text = ANY($3::text[])
        `,
        [selected, cart.cart_id, itemUuids]
      );
      updatedCount = Number(updateResult.rowCount || 0);
    }

    const countsResult = await pool.query(
      `
        SELECT
          COUNT(*)::int AS total_count,
          COUNT(*) FILTER (WHERE is_selected = TRUE)::int AS selected_count
        FROM cart_item
        WHERE cart_id = $1
      `,
      [cart.cart_id]
    );

    const counts = countsResult.rows[0] || { total_count: 0, selected_count: 0 };
    response.status(OK);
    response.$body = {
      data: {
        updatedCount,
        selectedCount: Number(counts.selected_count || 0),
        totalCount: Number(counts.total_count || 0)
      }
    };
    return next();
  } catch (e) {
    response.status(INTERNAL_SERVER_ERROR);
    return response.json({
      error: {
        status: INTERNAL_SERVER_ERROR,
        message: e.message || 'Failed to update cart selection'
      }
    });
  }
};

