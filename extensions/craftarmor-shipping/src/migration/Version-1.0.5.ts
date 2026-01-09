/**
 * Migration: add pickup metadata fields to cart_address.
 */
import { PoolClient } from 'pg';

export default async function (connection: PoolClient) {
  console.log('[craftarmor-shipping] Adding pickup fields to cart_address...');

  await connection.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cart_address' AND column_name = 'pickup_point_id'
      ) THEN
        ALTER TABLE cart_address
        ADD COLUMN pickup_point_id INT;
        COMMENT ON COLUMN cart_address.pickup_point_id IS 'Internal delivery_point.id for pickup';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cart_address' AND column_name = 'pickup_service_code'
      ) THEN
        ALTER TABLE cart_address
        ADD COLUMN pickup_service_code VARCHAR(50);
        COMMENT ON COLUMN cart_address.pickup_service_code IS 'Pickup service code (cdek, russianpost, etc.)';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cart_address' AND column_name = 'pickup_external_id'
      ) THEN
        ALTER TABLE cart_address
        ADD COLUMN pickup_external_id VARCHAR(255);
        COMMENT ON COLUMN cart_address.pickup_external_id IS 'Pickup point external id from carrier';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cart_address' AND column_name = 'pickup_data'
      ) THEN
        ALTER TABLE cart_address
        ADD COLUMN pickup_data JSONB;
        COMMENT ON COLUMN cart_address.pickup_data IS 'Snapshot of pickup point data';
      END IF;
    END $$;
  `);

  console.log('[craftarmor-shipping] Migration Version-1.0.5 completed successfully');
}
