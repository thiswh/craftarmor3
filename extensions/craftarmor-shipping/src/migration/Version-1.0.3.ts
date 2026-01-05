/**
 * Migration script to add order dimensions fields (total_length, total_width, total_height).
 */
import { PoolClient } from 'pg';

export default async function (connection: PoolClient) {
  console.log('[craftarmor-shipping] Adding order dimensions fields (total_length, total_width, total_height)...');

  await connection.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'order' AND column_name = 'total_length'
      ) THEN
        ALTER TABLE "order"
        ADD COLUMN total_length DECIMAL(10,2);
        COMMENT ON COLUMN "order".total_length IS 'Total package length in cm';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'order' AND column_name = 'total_width'
      ) THEN
        ALTER TABLE "order"
        ADD COLUMN total_width DECIMAL(10,2);
        COMMENT ON COLUMN "order".total_width IS 'Total package width in cm';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'order' AND column_name = 'total_height'
      ) THEN
        ALTER TABLE "order"
        ADD COLUMN total_height DECIMAL(10,2);
        COMMENT ON COLUMN "order".total_height IS 'Total package height in cm';
      END IF;
    END $$;
  `);

  console.log('[craftarmor-shipping] Order dimensions fields added successfully');
  console.log('[craftarmor-shipping] Migration Version-1.0.3 completed successfully');
}
