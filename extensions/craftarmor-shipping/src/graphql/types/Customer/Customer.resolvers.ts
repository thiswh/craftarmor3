import { select } from '@evershop/postgres-query-builder';
import { buildUrl } from '@evershop/evershop/lib/router';
import { camelCase } from '@evershop/evershop/lib/util/camelCase';
import { pool as defaultPool } from '@evershop/evershop/lib/postgres';

export default {
  Customer: {
    phone: async (customer: any, _args: unknown, context: any) => {
      if (customer.phone !== undefined) {
        return customer.phone;
      }
      const dbPool = context.pool || defaultPool;
      const record = await select()
        .from('customer')
        .where('customer_id', '=', customer.customerId)
        .load(dbPool);
      return record ? record.phone || null : null;
    },
    recipients: async (customer: any, _args: unknown, context: any) => {
      const dbPool = context.pool || defaultPool;
      const recipients = await select()
        .from('customer_recipient')
        .where('customer_id', '=', customer.customerId)
        .execute(dbPool);

      return recipients.map((recipient: any) => {
        const mapped = camelCase(recipient);
        const recipientId =
          mapped.customerRecipientId ?? recipient.customer_recipient_id;
        return {
          ...mapped,
          recipientId,
          updateApi: buildUrl('updateCustomerRecipient', {
            recipient_id: recipient.uuid,
            customer_id: customer.uuid
          }),
          deleteApi: buildUrl('deleteCustomerRecipient', {
            recipient_id: recipient.uuid,
            customer_id: customer.uuid
          })
        };
      });
    },
    addRecipientApi: (customer: any) =>
      buildUrl('createCustomerRecipient', {
        customer_id: customer.uuid
      })
  }
};
