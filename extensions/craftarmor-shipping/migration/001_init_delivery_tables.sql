-- CraftArmor Shipping extension: initial tables
-- NOTE: adjust schema to match EverShop migration runner if needed.

-- Delivery services registry (cdek, boxberry, russianpost)
CREATE TABLE IF NOT EXISTS delivery_service (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  api_url TEXT,
  api_key TEXT,
  settings JSONB,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Delivery points (pickup points / lockers / branches)
CREATE TABLE IF NOT EXISTS delivery_point (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES delivery_service(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL,
  code VARCHAR(100),
  name VARCHAR(500),
  address TEXT,
  city VARCHAR(255),
  region VARCHAR(255),
  postal_code VARCHAR(20),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  type VARCHAR(50), -- pvz | postamat | branch | courier
  work_schedule JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(service_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_point_service_active
  ON delivery_point(service_id, is_active);

CREATE INDEX IF NOT EXISTS idx_delivery_point_city
  ON delivery_point(city);

-- For bounding-box queries; if PostGIS is enabled, replace with spatial index.
CREATE INDEX IF NOT EXISTS idx_delivery_point_lat_lng
  ON delivery_point(latitude, longitude);

