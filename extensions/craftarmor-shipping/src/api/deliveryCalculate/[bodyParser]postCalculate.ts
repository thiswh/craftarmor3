/**
 * API endpoint для расчета стоимости доставки
 * POST /api/delivery/calculate
 * 
 * Этот файл зависит от bodyParser.ts (указано в имени файла [bodyParser])
 * EverShop автоматически применяет bodyParser перед этим handler'ом
 */
import { Request, Response } from 'express';
import { pool } from '@evershop/evershop/lib/postgres';
// @ts-ignore - модуль доступен в runtime
import { getConfig } from '@evershop/evershop/lib/util/getConfig';
import { getMyCart } from '@evershop/evershop/checkout/services';
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
    if (!pointId || !serviceCode) {
      response.$body = {
        success: false,
        message: 'Required parameters: pointId, serviceCode'
      };
      response.statusCode = 400;
      return;
    }

    // Валидация веса
    const shopWeightUnit = String(getConfig('shop.weightUnit', 'kg')).toLowerCase();
    const parseWeightToGrams = (value: unknown): number | undefined => {
      const num = parseFloat(String(value));
      if (!Number.isFinite(num) || num <= 0) {
        return undefined;
      }
      return shopWeightUnit === 'g' ? num : num * 1000;
    };

    let weightGrams = weight !== undefined ? parseWeightToGrams(weight) : undefined;
    let weightSource: 'body' | 'cart' = weightGrams !== undefined ? 'body' : 'cart';

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

    // Пытаемся получить размеры из корзины (приоритет)
    let finalLength: number | undefined = length ? parseFloat(length) : undefined;
    let finalWidth: number | undefined = width ? parseFloat(width) : undefined;
    let finalHeight: number | undefined = height ? parseFloat(height) : undefined;
    let dimensionsSource: 'body' | 'cart' = 'body';

    try {
      // Получаем имя cookie из конфига (аналогично getFrontStoreSessionCookieName)
      const cookieName = getConfig('system.session.cookieName', 'sid');
      const sessionID = request.signedCookies?.[cookieName];
      
      if (sessionID) {
        // Получаем cart по sessionID
        const cart = await getMyCart(sessionID, undefined);
        if (cart) {
          const cartLength = cart.getData('total_length');
          const cartWidth = cart.getData('total_width');
          const cartHeight = cart.getData('total_height');
          const cartWeight = cart.getData('total_weight');
          
          console.log('[postCalculate] Cart found by sessionID, dimensions from cart:', {
            total_length: cartLength,
            total_width: cartWidth,
            total_height: cartHeight,
            total_weight: cartWeight
          });
          
          // Используем данные из корзины, если они есть
          if (cartLength !== null && cartLength !== undefined) {
            finalLength = parseFloat(String(cartLength));
            dimensionsSource = 'cart';
          }
          if (cartWidth !== null && cartWidth !== undefined) {
            finalWidth = parseFloat(String(cartWidth));
            dimensionsSource = 'cart';
          }
          if (cartHeight !== null && cartHeight !== undefined) {
            finalHeight = parseFloat(String(cartHeight));
            dimensionsSource = 'cart';
          }
          if (cartWeight !== null && cartWeight !== undefined) {
            const cartWeightNum = parseFloat(String(cartWeight));
            if (Number.isFinite(cartWeightNum) && cartWeightNum > 0) {
              weightGrams = shopWeightUnit === 'g' ? cartWeightNum : cartWeightNum * 1000;
              weightSource = 'cart';
            }
          }
        } else {
          console.log('[postCalculate] Cart not found for sessionID, using body parameters');
        }
      } else {
        console.log('[postCalculate] No sessionID in cookies, using body parameters');
      }
    } catch (error) {
      // Если не удалось получить корзину, используем параметры из body (fallback)
      console.warn('[postCalculate] Failed to get cart from session, using body parameters:', error);
    }

    if (weightGrams === undefined || !Number.isFinite(weightGrams)) {
      response.$body = {
        success: false,
        message: 'Weight is required (provide weight in body or ensure cart has total_weight)'
      };
      response.statusCode = 400;
      return;
    }

    if (weightGrams <= 0 || weightGrams > 1000 * 1000) {
      response.$body = {
        success: false,
        message: 'Weight must be a positive number between 0 and 1000 kg'
      };
      response.statusCode = 400;
      return;
    }

    const weightKg = weightGrams / 1000;

    console.log('[postCalculate] Dimensions source:', dimensionsSource, {
      length: finalLength,
      width: finalWidth,
      height: finalHeight
    });
    console.log('[postCalculate] Weight source:', weightSource, {
      weightGrams,
      weightKg,
      unit: shopWeightUnit
    });

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
              weight: weightKg,
              length: finalLength,
              width: finalWidth,
              height: finalHeight
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
            weight: weightGrams, // в граммы
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
            weight: weightKg,
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
