/**
 * API endpoint для получения пунктов выдачи по границам карты
 * GET /api/delivery/points?bounds=minLat,minLng,maxLat,maxLng&services=cdek,russianpost
 */
import { Request, Response } from 'express';
import { pool } from '@evershop/evershop/lib/postgres';
import { DeliveryPointRepository } from '../../services/DeliveryPointRepository.js';

export default async function getPoints(request: Request, response: Response) {
  try {
    const bounds = request.query.bounds as string;
    const services = request.query.services as string | undefined;

    if (!bounds) {
      return response.status(400).json({
        success: false,
        message: 'Bounds parameter is required. Format: minLat,minLng,maxLat,maxLng'
      });
    }

    // Парсим границы карты
    const [minLat, minLng, maxLat, maxLng] = bounds.split(',').map(parseFloat);

    if (isNaN(minLat) || isNaN(minLng) || isNaN(maxLat) || isNaN(maxLng)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid bounds format. Expected: minLat,minLng,maxLat,maxLng'
      });
    }

    // Парсим фильтр по службам доставки
    let serviceCodes: string[] | undefined;
    if (services) {
      serviceCodes = services.split(',').map(s => s.trim());
    }

    // Получаем пункты из БД
    const repository = new DeliveryPointRepository(pool);
    const points = await repository.getPointsByBounds(
      minLat,
      minLng,
      maxLat,
      maxLng,
      serviceCodes
    );

    response.json({
      success: true,
      data: {
        points,
        count: points.length,
        bounds: {
          minLat,
          minLng,
          maxLat,
          maxLng
        }
      }
    });
  } catch (error: any) {
    console.error('[getPoints] Error:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}


