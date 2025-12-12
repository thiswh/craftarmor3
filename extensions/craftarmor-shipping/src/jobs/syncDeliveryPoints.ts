/**
 * Cron job для синхронизации пунктов выдачи
 * Вызывается ежедневно в 03:00
 */
import { pool } from '@evershop/evershop/lib/postgres';
import { CdekService } from '../services/cdek/CdekService.js';
import { RussianPostService } from '../services/russianpost/RussianPostService.js';
import { BoxberryService } from '../services/boxberry/BoxberryService.js';
import { DeliveryPointRepository } from '../services/DeliveryPointRepository.js';

export default async function syncDeliveryPoints() {
  const repository = new DeliveryPointRepository(pool);
  
  // Синхронизация CDEK
  try {
    console.log('[syncDeliveryPoints] Syncing CDEK points...');
    const cdekService = new CdekService();
    const cdekPoints = await cdekService.getDeliveryPoints();
    await repository.syncPoints('cdek', cdekPoints);
    console.log(`[syncDeliveryPoints] CDEK: ${cdekPoints.length} points synced`);
  } catch (error) {
    console.error('[syncDeliveryPoints] CDEK sync error:', error);
  }

  // Синхронизация Почты России
  try {
    console.log('[syncDeliveryPoints] Syncing Russian Post points...');
    const ruspostService = new RussianPostService();
    const ruspostPoints = await ruspostService.getDeliveryPoints();
    await repository.syncPoints('russianpost', ruspostPoints);
    console.log(`[syncDeliveryPoints] Russian Post: ${ruspostPoints.length} points synced`);
  } catch (error) {
    console.error('[syncDeliveryPoints] Russian Post sync error:', error);
  }

  // Синхронизация Boxberry (пока заглушка)
  try {
    console.log('[syncDeliveryPoints] Syncing Boxberry points...');
    const boxberryService = new BoxberryService();
    const boxberryPoints = await boxberryService.getDeliveryPoints();
    await repository.syncPoints('boxberry', boxberryPoints);
    console.log(`[syncDeliveryPoints] Boxberry: ${boxberryPoints.length} points synced`);
  } catch (error) {
    console.error('[syncDeliveryPoints] Boxberry sync error:', error);
  }

  // Отмечаем неактивные пункты
  await repository.markInactivePoints();
  console.log('[syncDeliveryPoints] Inactive points marked');
}


