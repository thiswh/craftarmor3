/**
 * Migration script для добавления полей размеров (length, width, height) в таблицу product
 * Выполняется автоматически при обновлении расширения
 */
import { PoolClient } from 'pg';

export default async function (connection: PoolClient) {
  console.log('[craftarmor-shipping] Adding product dimensions fields (length, width, height)...');

  // Добавляем поля размеров в таблицу product
  // Размеры в сантиметрах (DECIMAL для точности)
  await connection.query(`
    DO $$ 
    BEGIN
      -- Добавляем поле length (длина в см)
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product' AND column_name = 'length'
      ) THEN
        ALTER TABLE product 
        ADD COLUMN length DECIMAL(10,2);
        COMMENT ON COLUMN product.length IS 'Длина товара в сантиметрах';
      END IF;

      -- Добавляем поле width (ширина в см)
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product' AND column_name = 'width'
      ) THEN
        ALTER TABLE product 
        ADD COLUMN width DECIMAL(10,2);
        COMMENT ON COLUMN product.width IS 'Ширина товара в сантиметрах';
      END IF;

      -- Добавляем поле height (высота в см)
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product' AND column_name = 'height'
      ) THEN
        ALTER TABLE product 
        ADD COLUMN height DECIMAL(10,2);
        COMMENT ON COLUMN product.height IS 'Высота товара в сантиметрах';
      END IF;
    END $$;
  `);

  console.log('[craftarmor-shipping] Product dimensions fields added successfully');
  console.log('[craftarmor-shipping] Migration Version-1.0.2 completed successfully');
}
