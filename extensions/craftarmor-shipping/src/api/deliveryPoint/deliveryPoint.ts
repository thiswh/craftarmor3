/**
 * API endpoint для получения детальной информации о пункте выдачи
 * GET /api/delivery/points/:id
 */
import { Request, Response } from 'express';
import { pool } from '@evershop/evershop/lib/postgres';
import { DeliveryPointRepository } from '../../services/DeliveryPointRepository.js';

export default async function deliveryPoint(request: Request, response: Response) {
  try {
    const pointId = parseInt(request.params.id, 10);

    if (isNaN(pointId) || pointId <= 0) {
      response.$body = {
        success: false,
        message: 'Invalid point ID. Must be a positive integer.'
      };
      response.statusCode = 400;
      return;
    }

    // Получаем детальную информацию о пункте из БД
    const repository = new DeliveryPointRepository(pool);
    const point = await repository.getPointById(pointId);

    if (!point) {
      response.$body = {
        success: false,
        message: 'Delivery point not found or inactive'
      };
      response.statusCode = 404;
      return;
    }

    // Сохраняем данные в response.$body для EverShop middleware apiResponse
    response.$body = {
      success: true,
      data: {
        point
      }
    };
  } catch (error: any) {
    console.error('[deliveryPoint] Error:', error);
    response.$body = {
      success: false,
      message: 'Internal server error',
      error: error.message
    };
    response.statusCode = 500;
  }
}

