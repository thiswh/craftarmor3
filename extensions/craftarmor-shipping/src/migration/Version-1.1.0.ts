/**
 * Migration: add customer phone and ensure default recipient.
 */
import { PoolClient } from 'pg';

export default async function (connection: PoolClient) {
  console.log('[craftarmor-shipping] Adding customer phone column...');

  await connection.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customer' AND column_name = 'phone'
      ) THEN
        ALTER TABLE customer
        ADD COLUMN phone varchar DEFAULT NULL;
      END IF;
    END $$;
  `);

  console.log('[craftarmor-shipping] Ensuring default recipients from customer profile...');

  await connection.query(`
    UPDATE customer_recipient
    SET is_default = FALSE
    WHERE customer_id IN (
      SELECT customer_id FROM customer WHERE full_name IS NOT NULL OR phone IS NOT NULL
    );
  `);

  await connection.query(`
    INSERT INTO customer_recipient (customer_id, full_name, telephone, is_default)
    SELECT
      c.customer_id,
      c.full_name,
      c.phone,
      TRUE
    FROM customer c
    WHERE (c.full_name IS NOT NULL OR c.phone IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1
        FROM customer_recipient cr
        WHERE cr.customer_id = c.customer_id
          AND cr.full_name IS NOT DISTINCT FROM c.full_name
          AND cr.telephone IS NOT DISTINCT FROM c.phone
      );
  `);

  await connection.query(`
    UPDATE customer_recipient cr
    SET is_default = TRUE
    FROM customer c
    WHERE cr.customer_id = c.customer_id
      AND cr.full_name IS NOT DISTINCT FROM c.full_name
      AND cr.telephone IS NOT DISTINCT FROM c.phone;
  `);

  console.log('[craftarmor-shipping] Migration Version-1.1.0 completed successfully');
}
