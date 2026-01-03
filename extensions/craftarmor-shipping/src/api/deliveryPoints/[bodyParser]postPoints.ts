/**
 * API endpoint для получения пунктов выдачи по границам карты
 * POST /api/delivery/points
 * 
 * Использует POST для передачи bounds, services и excludeIds в body
 * Это позволяет передавать большие списки excludeIds без ограничений длины URL
 * 
 * Этот файл зависит от bodyParser.ts (указано в имени файла [bodyParser])
 * EverShop автоматически применяет bodyParser перед этим handler'ом
 */
import { Request, Response } from 'express';
import { pool } from '@evershop/evershop/lib/postgres';
import { DeliveryPointRepository } from '../../services/DeliveryPointRepository.js';

export default async function postPoints(request: Request, response: Response) {
  try {
    // Body уже распарсен middleware bodyParser.ts
    const body = request.body || {};
    const bounds = body.bounds as string;
    const services = body.services as string | string[] | undefined;
    const excludeIds = body.excludeIds as number[] | undefined;

    if (!bounds) {
      response.$body = {
        success: false,
        message: 'Bounds parameter is required. Format: minLat,minLng,maxLat,maxLng'
      };
      response.statusCode = 400;
      return;
    }

    // Парсим границы карты
    const [minLat, minLng, maxLat, maxLng] = bounds.split(',').map(parseFloat);

    if (isNaN(minLat) || isNaN(minLng) || isNaN(maxLat) || isNaN(maxLng)) {
      response.$body = {
        success: false,
        message: 'Invalid bounds format. Expected: minLat,minLng,maxLat,maxLng'
      };
      response.statusCode = 400;
      return;
    }

    // Парсим фильтр по службам доставки
    let serviceCodes: string[] | undefined;
    if (services) {
      if (typeof services === 'string') {
        serviceCodes = services.split(',').map(s => s.trim());
      } else if (Array.isArray(services)) {
        // Type guard для TypeScript
        const servicesArray: any[] = services;
        serviceCodes = servicesArray.map((s: any) => String(s).trim());
      }
    }

    // Валидация excludeIds
    let excludeIdsArray: number[] = [];
    if (excludeIds) {
      if (Array.isArray(excludeIds)) {
        excludeIdsArray = excludeIds
          .map(id => typeof id === 'number' ? id : parseInt(String(id), 10))
          .filter(id => !isNaN(id) && id > 0);
      }
    }

    const finalExcludeIds = excludeIdsArray.length > 0 ? excludeIdsArray : undefined;

    // Получаем краткую информацию о пунктах из БД
    const repository = new DeliveryPointRepository(pool);
    const points = await repository.getPointsSummary(
      minLat,
      minLng,
      maxLat,
      maxLng,
      serviceCodes,
      finalExcludeIds
    );

    // Сохраняем данные в response.$body для EverShop middleware apiResponse
    response.$body = {
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
    };
  } catch (error: any) {
    console.error('[postPoints] Error:', error);
    response.$body = {
      success: false,
      message: 'Internal server error',
      error: error.message
    };
    response.statusCode = 500;
  }
}
