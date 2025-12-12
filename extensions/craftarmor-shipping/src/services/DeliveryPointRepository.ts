/**
 * Repository для работы с пунктами выдачи в БД
 */
import { Pool } from 'pg';

export interface DeliveryPoint {
  serviceCode: string;
  externalId: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  region?: string;
  postalCode?: string;
  name?: string;
  schedule?: any; // JSON
  metadata?: any; // JSON
  isActive: boolean;
}

export class DeliveryPointRepository {
  constructor(private pool: Pool) {}

  /**
   * Синхронизация пунктов выдачи для конкретной службы
   */
  async syncPoints(serviceCode: string, points: DeliveryPoint[]): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Получаем ID службы доставки
      const serviceResult = await client.query(
        'SELECT id FROM delivery_service WHERE code = $1',
        [serviceCode]
      );

      if (serviceResult.rows.length === 0) {
        throw new Error(`Delivery service ${serviceCode} not found`);
      }

      const serviceId = serviceResult.rows[0].id;
      const externalIds = points.map(p => p.externalId);

      // Отмечаем все существующие пункты как неактивные
      await client.query(
        `UPDATE delivery_point 
         SET is_active = false, updated_at = NOW()
         WHERE service_id = $1 AND external_id != ALL($2::text[])`,
        [serviceId, externalIds]
      );

      // Вставляем или обновляем пункты
      for (const point of points) {
        await client.query(
          `INSERT INTO delivery_point (
            service_id, external_id, latitude, longitude,
            address, city, region, postal_code, name,
            schedule, metadata, is_active, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
          ON CONFLICT (service_id, external_id)
          DO UPDATE SET
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            address = EXCLUDED.address,
            city = EXCLUDED.city,
            region = EXCLUDED.region,
            postal_code = EXCLUDED.postal_code,
            name = EXCLUDED.name,
            schedule = EXCLUDED.schedule,
            metadata = EXCLUDED.metadata,
            is_active = EXCLUDED.is_active,
            updated_at = NOW()`,
          [
            serviceId,
            point.externalId,
            point.latitude,
            point.longitude,
            point.address,
            point.city,
            point.region || null,
            point.postalCode || null,
            point.name || null,
            point.schedule ? JSON.stringify(point.schedule) : null,
            point.metadata ? JSON.stringify(point.metadata) : null,
            point.isActive
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Получение пунктов выдачи в указанных границах карты
   */
  async getPointsByBounds(
    minLat: number,
    minLng: number,
    maxLat: number,
    maxLng: number,
    serviceCodes?: string[]
  ): Promise<any[]> {
    let query = `
      SELECT 
        dp.id,
        dp.external_id,
        dp.latitude,
        dp.longitude,
        dp.address,
        dp.city,
        dp.region,
        dp.postal_code,
        dp.name,
        dp.schedule,
        dp.metadata,
        ds.code as service_code,
        ds.name as service_name
      FROM delivery_point dp
      INNER JOIN delivery_service ds ON dp.service_id = ds.id
      WHERE dp.is_active = true
        AND dp.latitude BETWEEN $1 AND $3
        AND dp.longitude BETWEEN $2 AND $4
    `;

    const params: any[] = [minLat, minLng, maxLat, maxLng];

    if (serviceCodes && serviceCodes.length > 0) {
      query += ` AND ds.code = ANY($5::text[])`;
      params.push(serviceCodes);
    }

    query += ` ORDER BY dp.city, dp.address`;

    const result = await this.pool.query(query, params);
    return result.rows.map(row => ({
      ...row,
      schedule: row.schedule ? JSON.parse(row.schedule) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }));
  }

  /**
   * Получение пункта выдачи по ID
   */
  async getPointById(pointId: number): Promise<any | null> {
    const result = await this.pool.query(
      `SELECT 
        dp.*,
        ds.code as service_code,
        ds.name as service_name
      FROM delivery_point dp
      INNER JOIN delivery_service ds ON dp.service_id = ds.id
      WHERE dp.id = $1 AND dp.is_active = true`,
      [pointId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      schedule: row.schedule ? JSON.parse(row.schedule) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    };
  }

  /**
   * Отметка неактивных пунктов (которые не были обновлены в последней синхронизации)
   */
  async markInactivePoints(): Promise<void> {
    // Пункты, которые не обновлялись более 2 дней, считаются неактивными
    await this.pool.query(
      `UPDATE delivery_point 
       SET is_active = false
       WHERE updated_at < NOW() - INTERVAL '2 days' AND is_active = true`
    );
  }
}


