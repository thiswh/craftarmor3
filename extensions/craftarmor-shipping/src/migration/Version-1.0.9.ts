/**
 * Migration: add customer_recipient table for checkout recipients.
 */
import { PoolClient } from 'pg';

export default async function (connection: PoolClient) {
  console.log('[craftarmor-shipping] Creating customer_recipient table...');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS customer_recipient (
      customer_recipient_id INT GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1) PRIMARY KEY,
      uuid UUID NOT NULL DEFAULT gen_random_uuid(),
      customer_id INT NOT NULL,
      full_name varchar DEFAULT NULL,
      telephone varchar DEFAULT NULL,
      is_default boolean DEFAULT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CUSTOMER_RECIPIENT_UUID_UNIQUE" UNIQUE ("uuid"),
      CONSTRAINT "FK_CUSTOMER_RECIPIENT" FOREIGN KEY ("customer_id")
        REFERENCES "customer" ("customer_id") ON DELETE CASCADE
    );
  `);

  await connection.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'FK_CUSTOMER_RECIPIENT'
      ) THEN
        CREATE INDEX "FK_CUSTOMER_RECIPIENT" ON "customer_recipient" ("customer_id");
      END IF;
    END $$;
  `);

  console.log('[craftarmor-shipping] Backfilling customer_recipient from customer_address...');

  await connection.query(`
    INSERT INTO customer_recipient (customer_id, full_name, telephone, is_default)
    SELECT
      ca.customer_id,
      ca.full_name,
      ca.telephone,
      BOOL_OR(ca.is_default) AS is_default
    FROM customer_address ca
    WHERE (ca.full_name IS NOT NULL OR ca.telephone IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1
        FROM customer_recipient cr
        WHERE cr.customer_id = ca.customer_id
          AND cr.full_name IS NOT DISTINCT FROM ca.full_name
          AND cr.telephone IS NOT DISTINCT FROM ca.telephone
      )
    GROUP BY ca.customer_id, ca.full_name, ca.telephone;
  `);

  console.log('[craftarmor-shipping] Migration Version-1.0.9 completed successfully');
}
