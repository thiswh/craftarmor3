/**
 * Migration script для создания таблиц delivery_service и delivery_point
 * Выполняется автоматически при установке расширения
 */
import { PoolClient } from 'pg';

export default async function (connection: PoolClient) {
  // Включаем PostGIS расширение для геопространственных запросов
  await connection.query(`CREATE EXTENSION IF NOT EXISTS postgis`);

  // Создаем таблицу delivery_service (службы доставки)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS delivery_service (
      id SERIAL PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      api_url VARCHAR(500),
      api_key TEXT,
      api_secret TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Создаем таблицу delivery_point (пункты выдачи)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS delivery_point (
      id SERIAL PRIMARY KEY,
      service_id INTEGER NOT NULL REFERENCES delivery_service(id) ON DELETE CASCADE,
      external_id VARCHAR(255) NOT NULL,
      latitude DECIMAL(10, 8) NOT NULL,
      longitude DECIMAL(11, 8) NOT NULL,
      address TEXT NOT NULL,
      city VARCHAR(255) NOT NULL,
      region VARCHAR(255),
      postal_code VARCHAR(20),
      name VARCHAR(500),
      schedule JSONB,
      metadata JSONB,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(service_id, external_id)
    )
  `);

  // Добавляем geometry колонку для PostGIS (если еще не существует)
  await connection.query(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_point' AND column_name = 'location'
      ) THEN
        ALTER TABLE delivery_point 
        ADD COLUMN location geometry(Point, 4326);
      END IF;
    END $$;
  `);

  // Заполняем geometry колонку существующими координатами
  await connection.query(`
    UPDATE delivery_point 
    SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    WHERE location IS NULL
  `);

  // Создаем индексы для быстрого поиска
  // GiST индекс для геопространственных запросов (PostGIS)
  await connection.query(`
    CREATE INDEX IF NOT EXISTS idx_delivery_point_location_gist 
    ON delivery_point USING GIST (location)
    WHERE is_active = true
  `);

  // Индекс для поиска по городу
  await connection.query(`
    CREATE INDEX IF NOT EXISTS idx_delivery_point_city 
    ON delivery_point(city)
  `);

  // Индекс для поиска активных пунктов
  await connection.query(`
    CREATE INDEX IF NOT EXISTS idx_delivery_point_active 
    ON delivery_point(is_active) 
    WHERE is_active = true
  `);

  // Индекс для поиска по службе доставки
  await connection.query(`
    CREATE INDEX IF NOT EXISTS idx_delivery_point_service 
    ON delivery_point(service_id)
  `);

  // Вставляем начальные данные о службах доставки
  await connection.query(`
    INSERT INTO delivery_service (code, name, is_active) 
    VALUES 
      ('cdek', 'CDEK', true),
      ('russianpost', 'Почта России', true),
      ('boxberry', 'Boxberry', false)
    ON CONFLICT (code) DO NOTHING
  `);

  console.log('[craftarmor-shipping] Migration Version-1.0.1 completed successfully');
}
