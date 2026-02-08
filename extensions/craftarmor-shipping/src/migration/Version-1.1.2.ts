/**
 * Migration: add courier_note and pickup metadata to cart/order addresses.
 */
import { PoolClient } from 'pg';

export default async function (connection: PoolClient) {
  console.log('[craftarmor-shipping] Adding courier_note and delivery fields...');

  await connection.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customer_address' AND column_name = 'courier_note'
      ) THEN
        ALTER TABLE customer_address
        ADD COLUMN courier_note TEXT;
        COMMENT ON COLUMN customer_address.courier_note IS 'Courier instruction note for this address';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cart_address' AND column_name = 'courier_note'
      ) THEN
        ALTER TABLE cart_address
        ADD COLUMN courier_note TEXT;
        COMMENT ON COLUMN cart_address.courier_note IS 'Courier instruction note for this address';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'order_address' AND column_name = 'courier_note'
      ) THEN
        ALTER TABLE order_address
        ADD COLUMN courier_note TEXT;
        COMMENT ON COLUMN order_address.courier_note IS 'Courier instruction note for this order address';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cart_address' AND column_name = 'delivery_type'
      ) THEN
        ALTER TABLE cart_address
        ADD COLUMN delivery_type VARCHAR(20) DEFAULT 'courier';
        COMMENT ON COLUMN cart_address.delivery_type IS 'Address type: courier or pickup';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'order_address' AND column_name = 'delivery_type'
      ) THEN
        ALTER TABLE order_address
        ADD COLUMN delivery_type VARCHAR(20) DEFAULT 'courier';
        COMMENT ON COLUMN order_address.delivery_type IS 'Address type: courier or pickup';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'order_address' AND column_name = 'pickup_point_id'
      ) THEN
        ALTER TABLE order_address
        ADD COLUMN pickup_point_id INT;
        COMMENT ON COLUMN order_address.pickup_point_id IS 'Internal delivery_point.id for pickup';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'order_address' AND column_name = 'pickup_service_code'
      ) THEN
        ALTER TABLE order_address
        ADD COLUMN pickup_service_code VARCHAR(50);
        COMMENT ON COLUMN order_address.pickup_service_code IS 'Pickup service code (cdek, russianpost, etc.)';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'order_address' AND column_name = 'pickup_external_id'
      ) THEN
        ALTER TABLE order_address
        ADD COLUMN pickup_external_id VARCHAR(255);
        COMMENT ON COLUMN order_address.pickup_external_id IS 'Pickup point external id from carrier';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'order_address' AND column_name = 'pickup_data'
      ) THEN
        ALTER TABLE order_address
        ADD COLUMN pickup_data JSONB;
        COMMENT ON COLUMN order_address.pickup_data IS 'Snapshot of pickup point data';
      END IF;
    END $$;
  `);

  await connection.query(`
    UPDATE cart_address
    SET delivery_type = 'courier'
    WHERE delivery_type IS NULL
  `);

  await connection.query(`
    UPDATE order_address
    SET delivery_type = 'courier'
    WHERE delivery_type IS NULL
  `);

  console.log('[craftarmor-shipping] Migration Version-1.1.2 completed successfully');
}
