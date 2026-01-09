/**
 * Migration: add cart_item dimension snapshot fields and backfill.
 */
import { PoolClient } from 'pg';

export default async function (connection: PoolClient) {
  console.log('[craftarmor-shipping] Adding cart_item dimension snapshot fields...');

  await connection.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cart_item' AND column_name = 'product_length'
      ) THEN
        ALTER TABLE cart_item
        ADD COLUMN product_length DECIMAL(10,2);
        COMMENT ON COLUMN cart_item.product_length IS 'Snapshot length in cm';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cart_item' AND column_name = 'product_width'
      ) THEN
        ALTER TABLE cart_item
        ADD COLUMN product_width DECIMAL(10,2);
        COMMENT ON COLUMN cart_item.product_width IS 'Snapshot width in cm';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cart_item' AND column_name = 'product_height'
      ) THEN
        ALTER TABLE cart_item
        ADD COLUMN product_height DECIMAL(10,2);
        COMMENT ON COLUMN cart_item.product_height IS 'Snapshot height in cm';
      END IF;
    END $$;
  `);

  console.log('[craftarmor-shipping] Backfilling cart_item snapshot dimensions...');

  await connection.query(`
    UPDATE cart_item ci
    SET
      product_length = COALESCE(ci.product_length, p.length),
      product_width = COALESCE(ci.product_width, p.width),
      product_height = COALESCE(ci.product_height, p.height),
      product_weight = COALESCE(ci.product_weight, p.weight)
    FROM product p
    WHERE p.product_id = ci.product_id
      AND (
        ci.product_length IS NULL
        OR ci.product_width IS NULL
        OR ci.product_height IS NULL
        OR ci.product_weight IS NULL
      )
  `);

  console.log('[craftarmor-shipping] Migration Version-1.0.7 completed successfully');
}
