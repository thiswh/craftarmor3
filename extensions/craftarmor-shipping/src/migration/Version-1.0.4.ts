/**
 * Migration: add pickup/courier metadata to customer_address.
 */
import { PoolClient } from 'pg';

export default async function (connection: PoolClient) {
  console.log('[craftarmor-shipping] Adding delivery metadata fields to customer_address...');

  await connection.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customer_address' AND column_name = 'delivery_type'
      ) THEN
        ALTER TABLE customer_address
        ADD COLUMN delivery_type VARCHAR(20) DEFAULT 'courier';
        COMMENT ON COLUMN customer_address.delivery_type IS 'Address type: courier or pickup';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customer_address' AND column_name = 'pickup_point_id'
      ) THEN
        ALTER TABLE customer_address
        ADD COLUMN pickup_point_id INT;
        COMMENT ON COLUMN customer_address.pickup_point_id IS 'Internal delivery_point.id for pickup';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customer_address' AND column_name = 'pickup_service_code'
      ) THEN
        ALTER TABLE customer_address
        ADD COLUMN pickup_service_code VARCHAR(50);
        COMMENT ON COLUMN customer_address.pickup_service_code IS 'Pickup service code (cdek, russianpost, etc.)';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customer_address' AND column_name = 'pickup_external_id'
      ) THEN
        ALTER TABLE customer_address
        ADD COLUMN pickup_external_id VARCHAR(255);
        COMMENT ON COLUMN customer_address.pickup_external_id IS 'Pickup point external id from carrier';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customer_address' AND column_name = 'pickup_data'
      ) THEN
        ALTER TABLE customer_address
        ADD COLUMN pickup_data JSONB;
        COMMENT ON COLUMN customer_address.pickup_data IS 'Snapshot of pickup point data';
      END IF;
    END $$;
  `);

  await connection.query(`
    UPDATE customer_address
    SET delivery_type = 'courier'
    WHERE delivery_type IS NULL
  `);

  await connection.query(`
    CREATE INDEX IF NOT EXISTS idx_customer_address_type
    ON customer_address(customer_id, delivery_type)
  `);

  console.log('[craftarmor-shipping] Migration Version-1.0.4 completed successfully');
}
