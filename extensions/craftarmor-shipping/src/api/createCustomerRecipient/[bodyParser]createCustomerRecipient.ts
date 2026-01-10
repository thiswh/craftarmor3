import { select } from '@evershop/postgres-query-builder';
import { pool } from '@evershop/evershop/lib/postgres';
import { buildUrl } from '@evershop/evershop/lib/router';
import {
  INTERNAL_SERVER_ERROR,
  INVALID_PAYLOAD,
  OK
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

export default async (request, response, next) => {
  try {
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

    const fullName = request.body?.full_name ?? request.body?.fullName ?? null;
    const telephone = request.body?.telephone ?? null;
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
      INSERT INTO customer_recipient
        (customer_id, full_name, telephone, is_default)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
      [customer.customer_id, fullName, telephone, isDefault]
    );

    const recipient = result.rows[0];

    response.status(OK);
    response.$body = {
      data: {
        recipientId: recipient.customer_recipient_id,
        uuid: recipient.uuid,
        fullName: recipient.full_name,
        telephone: recipient.telephone,
        isDefault: recipient.is_default,
        updateApi: buildUrl('updateCustomerRecipient', {
          recipient_id: recipient.uuid,
          customer_id: request.params.customer_id
        }),
        deleteApi: buildUrl('deleteCustomerRecipient', {
          recipient_id: recipient.uuid,
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
