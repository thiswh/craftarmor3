/**
 * Migration: add is_selected to cart_item for partial checkout flow.
 */
import { PoolClient } from 'pg';

export default async function (connection: PoolClient) {
  console.log('[craftarmor-shipping] Adding cart_item.is_selected...');

  await connection.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'cart_item' AND column_name = 'is_selected'
      ) THEN
        ALTER TABLE cart_item
        ADD COLUMN is_selected BOOLEAN NOT NULL DEFAULT TRUE;
        COMMENT ON COLUMN cart_item.is_selected IS 'Used for partial checkout selection';
      END IF;
    END $$;
  `);

  await connection.query(`
    UPDATE cart_item
    SET is_selected = TRUE
    WHERE is_selected IS NULL
  `);

  console.log('[craftarmor-shipping] Migration Version-1.1.3 completed successfully');
}

