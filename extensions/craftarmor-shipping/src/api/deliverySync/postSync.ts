/**
 * API endpoint для ручного запуска синхронизации пунктов выдачи
 * POST /api/delivery/sync
 * 
 * Параметры запроса (опционально):
 * - services: массив кодов служб для синхронизации (например: ["cdek", "russianpost"])
 *   Если не указано, синхронизируются все активные службы
 */
import { Request, Response } from 'express';
import { pool } from '@evershop/evershop/lib/postgres';
import { CdekService } from '../../services/cdek/CdekService.js';
import { RussianPostService } from '../../services/russianpost/RussianPostService.js';
import { BoxberryService } from '../../services/boxberry/BoxberryService.js';
import { DeliveryPointRepository } from '../../services/DeliveryPointRepository.js';

export default async function postSync(request: Request, response: Response) {
  // Проверяем, не был ли уже отправлен response
  if (response.headersSent) {
    console.warn('[postSync] Response already sent, skipping');
    return;
  }

  try {
    // Безопасная обработка body (может быть undefined если запрос без тела)
    const body = request.body || {};
    const { services } = body;
    
    const repository = new DeliveryPointRepository(pool);
    const results: any = {
      success: true,
      services: {},
      totalPoints: 0,
      errors: []
    };

    // Определяем, какие службы синхронизировать
    const servicesToSync = services && Array.isArray(services) 
      ? services 
      : ['cdek', 'russianpost', 'boxberry'];

    // Синхронизация CDEK
    if (servicesToSync.includes('cdek')) {
      try {
        console.log('[postSync] Starting CDEK synchronization...');
        const cdekService = new CdekService();
        const cdekPoints = await cdekService.getDeliveryPoints();
        await repository.syncPoints('cdek', cdekPoints);
        results.services.cdek = {
          success: true,
          pointsCount: cdekPoints.length
        };
        results.totalPoints += cdekPoints.length;
        console.log(`[postSync] CDEK: ${cdekPoints.length} points synced`);
      } catch (error: any) {
        console.error('[postSync] CDEK sync error:', error);
        results.services.cdek = {
          success: false,
          error: error.message
        };
        results.errors.push({
          service: 'cdek',
          error: error.message
        });
      }
    }

    // Синхронизация Почты России
    if (servicesToSync.includes('russianpost')) {
      try {
        console.log('[postSync] Starting Russian Post synchronization...');
        const ruspostService = new RussianPostService();
        const ruspostPoints = await ruspostService.getDeliveryPoints();
        await repository.syncPoints('russianpost', ruspostPoints);
        results.services.russianpost = {
          success: true,
          pointsCount: ruspostPoints.length
        };
        results.totalPoints += ruspostPoints.length;
        console.log(`[postSync] Russian Post: ${ruspostPoints.length} points synced`);
      } catch (error: any) {
        console.error('[postSync] Russian Post sync error:', error);
        results.services.russianpost = {
          success: false,
          error: error.message
        };
        results.errors.push({
          service: 'russianpost',
          error: error.message
        });
      }
    }

    // Синхронизация Boxberry
    if (servicesToSync.includes('boxberry')) {
      try {
        console.log('[postSync] Starting Boxberry synchronization...');
        const boxberryService = new BoxberryService();
        const boxberryPoints = await boxberryService.getDeliveryPoints();
        await repository.syncPoints('boxberry', boxberryPoints);
        results.services.boxberry = {
          success: true,
          pointsCount: boxberryPoints.length
        };
        results.totalPoints += boxberryPoints.length;
        console.log(`[postSync] Boxberry: ${boxberryPoints.length} points synced`);
      } catch (error: any) {
        console.error('[postSync] Boxberry sync error:', error);
        results.services.boxberry = {
          success: false,
          error: error.message
        };
        results.errors.push({
          service: 'boxberry',
          error: error.message
        });
      }
    }

    // Отмечаем неактивные пункты
    try {
      await repository.markInactivePoints();
      console.log('[postSync] Inactive points marked');
    } catch (error: any) {
      console.error('[postSync] Error marking inactive points:', error);
    }

    // Определяем общий статус
    const hasErrors = results.errors.length > 0;
    results.success = !hasErrors || results.totalPoints > 0;

    // Сохраняем данные в response.$body для EverShop middleware apiResponse
    response.$body = {
      ...results,
      message: hasErrors 
        ? `Synchronization completed with ${results.errors.length} error(s). Total points: ${results.totalPoints}`
        : `Synchronization completed successfully. Total points: ${results.totalPoints}`
    };
  } catch (error: any) {
    console.error('[postSync] Fatal error:', error);
    
    // Для ошибок также используем response.$body
    response.$body = {
      success: false,
      message: 'Internal server error during synchronization',
      error: error.message
    };
    response.statusCode = 500;
  }
}
