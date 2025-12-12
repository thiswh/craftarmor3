/**
 * API endpoint для расчета стоимости доставки
 * POST /api/delivery/calculate
 */
import { Request, Response } from 'express';
import { pool } from '@evershop/evershop/lib/postgres';
import { DeliveryPointRepository } from '../../services/DeliveryPointRepository.js';
import { CdekService } from '../../services/cdek/CdekService.js';
import { RussianPostService } from '../../services/russianpost/RussianPostService.js';
import { BoxberryService } from '../../services/boxberry/BoxberryService.js';

export default async function postCalculate(request: Request, response: Response) {
  try {
    const {
      pointId,
      serviceCode,
      weight,
      length,
      width,
      height,
      declaredValue
    } = request.body;

    // Валидация
    if (!pointId || !serviceCode || !weight) {
      return response.status(400).json({
        success: false,
        message: 'Required parameters: pointId, serviceCode, weight'
      });
    }

    // Получаем информацию о пункте выдачи
    const repository = new DeliveryPointRepository(pool);
    const point = await repository.getPointById(pointId);

    if (!point) {
      return response.status(404).json({
        success: false,
        message: 'Delivery point not found'
      });
    }

    // Получаем настройки отправителя из конфига или переменных окружения
    const senderPostalCode = process.env.SHOP_SENDER_POSTAL || '';
    const senderCity = process.env.SHOP_SENDER_CITY || '';

    if (!senderPostalCode) {
      return response.status(500).json({
        success: false,
        message: 'Shop sender postal code not configured'
      });
    }

    let result;

    try {
      switch (serviceCode) {
        case 'cdek': {
          const cdekService = new CdekService();
          result = await cdekService.calculateDelivery({
            fromLocation: {
              postalCode: senderPostalCode
            },
            toLocation: {
              postalCode: point.postal_code || undefined,
              city: point.city,
              address: point.address
            },
            packages: [{
              weight: parseFloat(weight),
              length: length ? parseFloat(length) : undefined,
              width: width ? parseFloat(width) : undefined,
              height: height ? parseFloat(height) : undefined
            }]
          });
          break;
        }

        case 'russianpost': {
          const ruspostService = new RussianPostService();
          if (!point.postal_code) {
            throw new Error('Postal code required for Russian Post calculation');
          }
          result = await ruspostService.calculateDelivery({
            fromPostalCode: senderPostalCode,
            toPostalCode: point.postal_code,
            weight: parseFloat(weight) * 1000, // в граммы
            mailType: 2, // посылка
            declaredValue: declaredValue ? parseFloat(declaredValue) : undefined
          });
          break;
        }

        case 'boxberry': {
          const boxberryService = new BoxberryService();
          result = await boxberryService.calculateDelivery({
            toCity: point.city,
            weight: parseFloat(weight),
            declaredValue: declaredValue ? parseFloat(declaredValue) : undefined
          });
          break;
        }

        default:
          return response.status(400).json({
            success: false,
            message: `Unknown service code: ${serviceCode}`
          });
      }

      response.json({
        success: true,
        data: {
          point: {
            id: point.id,
            address: point.address,
            city: point.city,
            serviceCode: point.service_code
          },
          calculation: result
        }
      });
    } catch (calcError: any) {
      // Если расчет не удался, возвращаем ошибку, но не падаем
      console.error(`[postCalculate] Calculation error for ${serviceCode}:`, calcError);
      response.status(500).json({
        success: false,
        message: `Failed to calculate delivery cost: ${calcError.message}`
      });
    }
  } catch (error: any) {
    console.error('[postCalculate] Error:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}


