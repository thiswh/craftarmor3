/**
 * API endpoint для расчета стоимости доставки
 * POST /api/delivery/calculate
 * 
 * Этот файл зависит от bodyParser.ts (указано в имени файла [bodyParser])
 * EverShop автоматически применяет bodyParser перед этим handler'ом
 */
import { Request, Response } from 'express';
import { pool } from '@evershop/evershop/lib/postgres';
import { DeliveryPointRepository } from '../../services/DeliveryPointRepository.js';
import { CdekService } from '../../services/cdek/CdekService.js';
import { RussianPostService } from '../../services/russianpost/RussianPostService.js';
import { BoxberryService } from '../../services/boxberry/BoxberryService.js';

export default async function postCalculate(request: Request, response: Response) {
  try {
    // Body уже распарсен middleware bodyParser.ts
    const body = request.body || {};
    
    const {
      pointId,
      serviceCode,
      weight,
      length,
      width,
      height,
      declaredValue,
      phoneNumber,
      pointData  // Опциональные данные точки для оптимизации (избегаем повторного запроса к БД)
    } = body;

    // Валидация обязательных параметров
    if (!pointId || !serviceCode || !weight) {
      response.$body = {
        success: false,
        message: 'Required parameters: pointId, serviceCode, weight'
      };
      response.statusCode = 400;
      return;
    }

    // Валидация веса
    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0 || weightNum > 1000) {
      response.$body = {
        success: false,
        message: 'Weight must be a positive number between 0 and 1000 kg'
      };
      response.statusCode = 400;
      return;
    }

    // Валидация размеров (если указаны)
    if (length !== undefined) {
      const lengthNum = parseFloat(length);
      if (isNaN(lengthNum) || lengthNum <= 0 || lengthNum > 1000) {
        response.$body = {
          success: false,
          message: 'Length must be a positive number between 0 and 1000 cm'
        };
        response.statusCode = 400;
        return;
      }
    }
    if (width !== undefined) {
      const widthNum = parseFloat(width);
      if (isNaN(widthNum) || widthNum <= 0 || widthNum > 1000) {
        response.$body = {
          success: false,
          message: 'Width must be a positive number between 0 and 1000 cm'
        };
        response.statusCode = 400;
        return;
      }
    }
    if (height !== undefined) {
      const heightNum = parseFloat(height);
      if (isNaN(heightNum) || heightNum <= 0 || heightNum > 1000) {
        response.$body = {
          success: false,
          message: 'Height must be a positive number between 0 and 1000 cm'
        };
        response.statusCode = 400;
        return;
      }
    }

    // Получаем информацию о пункте выдачи
    // Если данные точки переданы в запросе - используем их (оптимизация)
    // Если нет - загружаем из БД (fallback для обратной совместимости)
    let point: any;

    if (pointData) {
      // Используем переданные данные точки (БЕЗ запроса к БД)
      point = {
        id: pointId,
        postal_code: pointData.postal_code || pointData.postalCode,
        city: pointData.city,
        address: pointData.address,
        region: pointData.region,
        service_code: pointData.service_code || pointData.serviceCode || serviceCode
      };

      // Валидация обязательных полей для расчета
      if (serviceCode === 'cdek' && !point.postal_code && !point.city) {
        response.$body = {
          success: false,
          message: 'CDEK calculation requires either postal_code or city in pointData'
        };
        response.statusCode = 400;
        return;
      }

      if (serviceCode === 'russianpost' && !point.postal_code) {
        response.$body = {
          success: false,
          message: 'Postal code required in pointData for Russian Post calculation'
        };
        response.statusCode = 400;
        return;
      }

      if (serviceCode === 'boxberry' && !point.city) {
        response.$body = {
          success: false,
          message: 'City required in pointData for Boxberry calculation'
        };
        response.statusCode = 400;
        return;
      }
    } else {
      // Fallback: загружаем из БД (для обратной совместимости)
      const repository = new DeliveryPointRepository(pool);
      point = await repository.getPointById(pointId);

      if (!point) {
        response.$body = {
          success: false,
          message: 'Delivery point not found'
        };
        response.statusCode = 404;
        return;
      }
    }

    // Получаем настройки отправителя из конфига или переменных окружения
    const senderPostalCode = process.env.SHOP_SENDER_POSTAL || '';
    const senderCity = process.env.SHOP_SENDER_CITY || '';

    if (!senderPostalCode) {
      response.$body = {
        success: false,
        message: 'Shop sender postal code not configured'
      };
      response.statusCode = 500;
      return;
    }

    let result;

    try {
      switch (serviceCode) {
        case 'cdek': {
          const cdekService = CdekService.getInstance();
          
          // Для CDEK требуется либо postal_code, либо city для to_location
          if (!point.postal_code && !point.city) {
            throw new Error('CDEK calculation requires either postal_code or city for delivery point');
          }
          
          result = await cdekService.calculateDelivery({
            fromLocation: {
              postalCode: senderPostalCode
            },
            toLocation: {
              postalCode: point.postal_code || undefined,
              city: point.city || undefined,
              address: point.address || undefined,
              region: point.region || undefined
            },
            packages: [{
              weight: weightNum,
              length: length ? parseFloat(length) : undefined,
              width: width ? parseFloat(width) : undefined,
              height: height ? parseFloat(height) : undefined
            }],
            declaredValue: declaredValue ? parseFloat(declaredValue) : undefined,
            phoneNumber: phoneNumber || undefined
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
            weight: weightNum * 1000, // в граммы
            mailType: 2, // посылка
            declaredValue: declaredValue ? parseFloat(declaredValue) : undefined
          });
          break;
        }

        case 'boxberry': {
          const boxberryService = new BoxberryService();
          if (!point.city) {
            throw new Error('City required for Boxberry calculation');
          }
          result = await boxberryService.calculateDelivery({
            toCity: point.city,
            weight: weightNum,
            declaredValue: declaredValue ? parseFloat(declaredValue) : undefined
          });
          break;
        }

        default:
          response.$body = {
            success: false,
            message: `Unknown service code: ${serviceCode}`
          };
          response.statusCode = 400;
          return;
      }

      // Сохраняем данные в response.$body для EverShop middleware apiResponse
      response.$body = {
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
      };
    } catch (calcError: any) {
      // Если расчет не удался, возвращаем ошибку, но не падаем
      console.error(`[postCalculate] Calculation error for ${serviceCode}:`, calcError);
      response.$body = {
        success: false,
        message: `Failed to calculate delivery cost: ${calcError.message}`
      };
      response.statusCode = 500;
    }
  } catch (error: any) {
    console.error('[postCalculate] Error:', error);
    response.$body = {
      success: false,
      message: 'Internal server error',
      error: error.message
    };
    response.statusCode = 500;
  }
}
