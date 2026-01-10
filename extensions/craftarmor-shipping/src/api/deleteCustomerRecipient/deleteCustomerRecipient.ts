import { select } from '@evershop/postgres-query-builder';
import { pool } from '@evershop/evershop/lib/postgres';
import {
  INTERNAL_SERVER_ERROR,
  INVALID_PAYLOAD,
  OK
} from '@evershop/evershop/lib/util/httpStatus';

export default async (request, response) => {
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

    if (recipient.is_default) {
      response.status(INVALID_PAYLOAD);
      return response.json({
        error: {
          status: INVALID_PAYLOAD,
          message: 'Default recipient cannot be deleted'
        }
      });
    }

    await pool.query('DELETE FROM customer_recipient WHERE uuid = $1', [
      recipient.uuid
    ]);

    response.status(OK);
    return response.json({ success: true });
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
