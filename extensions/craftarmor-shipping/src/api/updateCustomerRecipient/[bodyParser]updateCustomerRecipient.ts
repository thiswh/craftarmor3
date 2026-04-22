import { select } from '@evershop/postgres-query-builder';
import { pool } from '@evershop/evershop/lib/postgres';
import { buildUrl } from '@evershop/evershop/lib/router';
import {
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  INVALID_PAYLOAD,
  OK,
  UNAUTHORIZED
} from '@evershop/evershop/lib/util/httpStatus';

const toBoolean = (value: unknown) => {
  if (value === true || value === false) {
    return value;
  }
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }
  return null;
};

const normalizeName = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = String(value).replace(/\s+/g, ' ').trim();
  return normalized || null;
};

const normalizeTelephone = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = String(value).replace(/\D+/g, '').slice(0, 15);
  return normalized || null;
};

export default async (request, response, next) => {
  try {
    const currentCustomer =
      (typeof request.getCurrentCustomer === 'function'
        ? request.getCurrentCustomer()
        : null) ||
      request.currentCustomer ||
      request.locals?.customer;
    if (!currentCustomer) {
      response.status(UNAUTHORIZED);
      return response.json({
        error: {
          status: UNAUTHORIZED,
          message: 'Authentication required'
        }
      });
    }

    if (currentCustomer.uuid !== request.params.customer_id) {
      response.status(FORBIDDEN);
      return response.json({
        error: {
          status: FORBIDDEN,
          message: 'Access denied'
        }
      });
    }

    const customer = await select()
      .from('customer')
      .where('uuid', '=', request.params.customer_id)
      .load(pool);
    if (!customer) {
      response.status(INVALID_PAYLOAD);
      return response.json({
        error: {
          status: INVALID_PAYLOAD,
          message: 'Invalid customer'
        }
      });
    }

    const recipient = await select()
      .from('customer_recipient')
      .where('uuid', '=', request.params.recipient_id)
      .and('customer_id', '=', customer.customer_id)
      .load(pool);
    if (!recipient) {
      response.status(INVALID_PAYLOAD);
      return response.json({
        error: {
          status: INVALID_PAYLOAD,
          message: 'Invalid recipient'
        }
      });
    }

    const fullName = normalizeName(
      request.body?.full_name ?? request.body?.fullName ?? null
    );
    const telephone = normalizeTelephone(request.body?.telephone ?? null);
    const isDefault = toBoolean(
      request.body?.is_default ?? request.body?.isDefault ?? null
    );

    if (isDefault === true) {
      await pool.query(
        'UPDATE customer_recipient SET is_default = FALSE WHERE customer_id = $1',
        [customer.customer_id]
      );
    }

    const result = await pool.query(
      `
      UPDATE customer_recipient
      SET
        full_name = COALESCE($1, full_name),
        telephone = COALESCE($2, telephone),
        is_default = COALESCE($3, is_default),
        updated_at = CURRENT_TIMESTAMP
      WHERE uuid = $4
      RETURNING *
    `,
      [fullName, telephone, isDefault, recipient.uuid]
    );

    const updated = result.rows[0];

    response.status(OK);
    response.$body = {
      data: {
        recipientId: updated.customer_recipient_id,
        uuid: updated.uuid,
        fullName: updated.full_name,
        telephone: updated.telephone,
        isDefault: updated.is_default,
        updateApi: buildUrl('updateCustomerRecipient', {
          recipient_id: updated.uuid,
          customer_id: request.params.customer_id
        }),
        deleteApi: buildUrl('deleteCustomerRecipient', {
          recipient_id: updated.uuid,
          customer_id: request.params.customer_id
        })
      }
    };
    return next();
  } catch (e) {
    response.status(INTERNAL_SERVER_ERROR);
    return response.json({
      error: {
        status: INTERNAL_SERVER_ERROR,
        message: e.message
      }
    });
  }
};
