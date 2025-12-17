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

      // Проверка на пустой массив - не помечать все как неактивные
      if (points.length === 0) {
        console.warn(`[DeliveryPointRepository] Empty points array for service ${serviceCode}, skipping sync`);
        await client.query('COMMIT');
        return;
      }

      const externalIds = points.map(p => p.externalId);

      // Отмечаем все существующие пункты как неактивные (только если есть новые данные)
      await client.query(
        `UPDATE delivery_point 
         SET is_active = false, updated_at = NOW()
         WHERE service_id = $1 AND external_id != ALL($2::text[])`,
        [serviceId, externalIds]
      );

      // Подготавливаем данные для bulk INSERT
      // Разбиваем на батчи по 500 пунктов, чтобы не превысить лимит параметров PostgreSQL
      // 500 пунктов * 12 параметров = 6000 параметров (лимит ~32767)
      const BATCH_SIZE = 500;
      
      for (let i = 0; i < points.length; i += BATCH_SIZE) {
        const batch = points.slice(i, i + BATCH_SIZE);
        const values: any[] = [];
        const placeholders: string[] = [];
        let paramIndex = 1;

        for (const point of batch) {
          // Валидация координат
          const latitude = Number(point.latitude);
          const longitude = Number(point.longitude);
          
          if (isNaN(latitude) || isNaN(longitude)) {
            console.warn(`[DeliveryPointRepository] Invalid coordinates for point ${point.externalId}: lat=${point.latitude}, lng=${point.longitude}`);
            continue; // Пропускаем пункт с невалидными координатами
          }

          // Обработка schedule: JSONB может хранить строки, числа, объекты, массивы
          let scheduleJson: string | null = null;
          if (point.schedule !== null && point.schedule !== undefined) {
            scheduleJson = JSON.stringify(point.schedule);
          }

          // Обработка metadata: всегда должен быть объект (или null)
          let metadataJson: string | null = null;
          if (point.metadata !== null && point.metadata !== undefined) {
            metadataJson = JSON.stringify(point.metadata);
          }

          // Формируем VALUES для одной строки с правильной нумерацией параметров
          // Добавляем location (geometry) для PostGIS, используя координаты из того же пункта
          // ST_MakePoint принимает (x, y) = (longitude, latitude)
          // Явно приводим к numeric для совместимости с PostGIS
          placeholders.push(
            `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}::numeric, $${paramIndex + 3}::numeric, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}::jsonb, $${paramIndex + 10}::jsonb, $${paramIndex + 11}, NOW(), NOW(), ST_SetSRID(ST_MakePoint($${paramIndex + 3}::numeric, $${paramIndex + 2}::numeric), 4326))`
          );

          values.push(
            serviceId,
            point.externalId,
            latitude,
            longitude,
            point.address,
            point.city,
            point.region || null,
            point.postalCode || null,
            point.name || null,
            scheduleJson,
            metadataJson,
            point.isActive
          );

          paramIndex += 12;
        }

        // Пропускаем батч, если все пункты были отфильтрованы
        if (placeholders.length === 0) {
          console.warn(`[DeliveryPointRepository] Batch ${i / BATCH_SIZE + 1} skipped: all points had invalid coordinates`);
          continue;
        }

        // Выполняем bulk INSERT для батча
        // Включаем location (geometry) для PostGIS
        const query = `
          INSERT INTO delivery_point (
            service_id, external_id, latitude, longitude,
            address, city, region, postal_code, name,
            schedule, metadata, is_active, created_at, updated_at,
            location
          ) VALUES ${placeholders.join(', ')}
          ON CONFLICT (service_id, external_id)
          DO UPDATE SET
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            location = ST_SetSRID(ST_MakePoint(EXCLUDED.longitude, EXCLUDED.latitude), 4326),
            address = EXCLUDED.address,
            city = EXCLUDED.city,
            region = EXCLUDED.region,
            postal_code = EXCLUDED.postal_code,
            name = EXCLUDED.name,
            schedule = EXCLUDED.schedule,
            metadata = EXCLUDED.metadata,
            is_active = EXCLUDED.is_active,
            updated_at = NOW()
        `;

        await client.query(query, values);
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
   * Получение краткой информации о пунктах выдачи в указанных границах карты
   * Используется для быстрой отрисовки карты
   * Возвращает только минимально необходимые данные: id, координаты, service_code, name
   */
  async getPointsSummary(
    minLat: number,
    minLng: number,
    maxLat: number,
    maxLng: number,
    serviceCodes?: string[]
  ): Promise<any[]> {
    // Используем PostGIS для быстрого геопространственного поиска
    // ST_MakeEnvelope(xmin, ymin, xmax, ymax, srid) где x=longitude, y=latitude
    // Оператор && использует GiST индекс для быстрой фильтрации
    // ST_Within проверяет точное попадание в границы
    let query = `
      SELECT 
        dp.id,
        dp.latitude,
        dp.longitude,
        ds.code as service_code,
        dp.name
      FROM delivery_point dp
      INNER JOIN delivery_service ds ON dp.service_id = ds.id
      WHERE dp.is_active = true
        AND dp.location && ST_MakeEnvelope($2, $1, $4, $3, 4326)
        AND ST_Within(dp.location, ST_MakeEnvelope($2, $1, $4, $3, 4326))
    `;

    const params: any[] = [minLat, minLng, maxLat, maxLng];

    if (serviceCodes && serviceCodes.length > 0) {
      query += ` AND ds.code = ANY($5::text[])`;
      params.push(serviceCodes);
    }

    // Сортируем для консистентности результатов
    query += ` ORDER BY dp.city, dp.address`;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Получение пунктов выдачи в указанных границах карты (полная информация)
   * @deprecated Используйте getPointsSummary() для карты и getPointById() для деталей
   * Оставлен для обратной совместимости
   */
  async getPointsByBounds(
    minLat: number,
    minLng: number,
    maxLat: number,
    maxLng: number,
    serviceCodes?: string[]
  ): Promise<any[]> {
    // Используем PostGIS для быстрого геопространственного поиска
    // ST_MakeEnvelope(xmin, ymin, xmax, ymax, srid) где x=longitude, y=latitude
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
        AND dp.location && ST_MakeEnvelope($2, $1, $4, $3, 4326)
        AND ST_Within(dp.location, ST_MakeEnvelope($2, $1, $4, $3, 4326))
    `;

    const params: any[] = [minLat, minLng, maxLat, maxLng];

    if (serviceCodes && serviceCodes.length > 0) {
      query += ` AND ds.code = ANY($5::text[])`;
      params.push(serviceCodes);
    }

    query += ` ORDER BY dp.city, dp.address`;

    const result = await this.pool.query(query, params);
    // PostgreSQL JSONB поля автоматически распарсиваются драйвером pg
    // schedule и metadata уже будут JavaScript объектами/строками/числами
    return result.rows;
  }

  /**
   * Получение детальной информации о пункте выдачи по ID
   */
  async getPointById(pointId: number): Promise<any | null> {
    const result = await this.pool.query(
      `SELECT 
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
      WHERE dp.id = $1 AND dp.is_active = true`,
      [pointId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    // PostgreSQL JSONB поля автоматически распарсиваются драйвером pg
    // schedule и metadata уже будут JavaScript объектами/строками/числами
    return result.rows[0];
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


