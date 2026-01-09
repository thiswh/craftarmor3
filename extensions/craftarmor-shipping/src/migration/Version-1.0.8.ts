/**
 * Migration: add order_item dimension snapshot fields.
 */
import { PoolClient } from 'pg';

export default async function (connection: PoolClient) {
  console.log('[craftarmor-shipping] Adding order_item dimension snapshot fields...');

  await connection.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'order_item' AND column_name = 'product_length'
      ) THEN
        ALTER TABLE order_item
        ADD COLUMN product_length DECIMAL(10,2);
        COMMENT ON COLUMN order_item.product_length IS 'Snapshot length in cm';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'order_item' AND column_name = 'product_width'
      ) THEN
        ALTER TABLE order_item
        ADD COLUMN product_width DECIMAL(10,2);
        COMMENT ON COLUMN order_item.product_width IS 'Snapshot width in cm';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'order_item' AND column_name = 'product_height'
      ) THEN
        ALTER TABLE order_item
        ADD COLUMN product_height DECIMAL(10,2);
        COMMENT ON COLUMN order_item.product_height IS 'Snapshot height in cm';
      END IF;
    END $$;
  `);

  console.log('[craftarmor-shipping] Backfilling order_item snapshot dimensions from product...');

  await connection.query(`
    UPDATE order_item oi
    SET
      product_length = COALESCE(oi.product_length, p.length),
      product_width = COALESCE(oi.product_width, p.width),
      product_height = COALESCE(oi.product_height, p.height)
    FROM product p
    WHERE p.product_id = oi.product_id
      AND (
        oi.product_length IS NULL
        OR oi.product_width IS NULL
        OR oi.product_height IS NULL
      )
  `);

  console.log('[craftarmor-shipping] Migration Version-1.0.8 completed successfully');
}
