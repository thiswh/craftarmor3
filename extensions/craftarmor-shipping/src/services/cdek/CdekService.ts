/**
 * Сервис для работы с API CDEK
 * Реализован как синглтон для переиспользования OAuth токена между запросами
 */
import { DeliveryPoint } from '../DeliveryPointRepository.js';

export class CdekService {
  private static instance: CdekService | null = null;
  private clientId: string;
  private clientSecret: string;
  private accessToken?: string;
  private tokenExpiresAt?: Date;
  private readonly apiUrl: string;
  private tokenPromise: Promise<string> | null = null; // Для предотвращения одновременных запросов токена

  private constructor() {
    this.apiUrl = process.env.CDEK_API_URL || 'https://api.cdek.ru';
    this.clientId = process.env.CDEK_CLIENT_ID || '';
    this.clientSecret = process.env.CDEK_CLIENT_SECRET || '';
    
    if (!this.clientId || !this.clientSecret) {
      throw new Error('CDEK_CLIENT_ID and CDEK_CLIENT_SECRET must be set in environment variables');
    }
  }

  /**
   * Получение единственного экземпляра сервиса (singleton)
   */
  public static getInstance(): CdekService {
    if (!CdekService.instance) {
      CdekService.instance = new CdekService();
    }
    return CdekService.instance;
  }

  /**
   * Получение OAuth2 токена
   * Использует Promise для предотвращения одновременных запросов токена
   */
  private async getAccessToken(): Promise<string> {
    // Если токен еще действителен, возвращаем его
    if (this.accessToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
      return this.accessToken;
    }

    // Если уже идет запрос токена, ждем его завершения
    if (this.tokenPromise) {
      return this.tokenPromise;
    }

    // Создаем новый запрос токена
    this.tokenPromise = (async () => {
      try {
        const response = await fetch(`${this.apiUrl}/v2/oauth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.clientId,
            client_secret: this.clientSecret,
          }),
        });

        if (!response.ok) {
          throw new Error(`CDEK OAuth failed: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.access_token) {
          throw new Error('CDEK OAuth failed: access_token not received');
        }
        
        const accessToken = data.access_token;
        this.accessToken = accessToken;
        // Токен обычно действителен 1 час, устанавливаем на 50 минут для безопасности
        this.tokenExpiresAt = new Date(Date.now() + (data.expires_in - 600) * 1000);

        return accessToken;
      } finally {
        // Очищаем promise после завершения
        this.tokenPromise = null;
      }
    })();

    return this.tokenPromise;
  }

  /**
   * Получение списка пунктов выдачи
   */
  async getDeliveryPoints(): Promise<DeliveryPoint[]> {
    const token = await this.getAccessToken();
    
    const response = await fetch(`${this.apiUrl}/v2/deliverypoints`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText || 'Unknown error');
      throw new Error(`CDEK API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      throw new Error(`CDEK API returned invalid data format. Expected array, got ${typeof data}`);
    }
    
    // Преобразуем данные CDEK в наш формат
    return data
      .filter((point: any) => {
        // Фильтруем пункты без координат
        const lat = parseFloat(point.location?.latitude);
        const lng = parseFloat(point.location?.longitude);
        return !isNaN(lat) && !isNaN(lng) && point.location;
      })
      .map((point: any) => ({
        serviceCode: 'cdek',
        externalId: point.code,
        latitude: parseFloat(point.location.latitude),
        longitude: parseFloat(point.location.longitude),
      address: point.location.address || '',
      city: point.location.city || '',
      region: point.location.region || '',
      postalCode: point.location.postal_code || '',
      name: point.name || '',
      schedule: point.work_time || null,
      metadata: {
        type: point.type,
        owner_code: point.owner_code,
      },
      isActive: true,
    }));
  }

  /**
   * Расчет стоимости доставки
   */
  async calculateDelivery(params: {
    fromLocation: {
      postalCode: string;
      city?: string;
      address?: string;
      region?: string;
    };
    toLocation: { postalCode?: string; city?: string; address?: string; region?: string };
    packages: Array<{ weight: number; length?: number; width?: number; height?: number }>;
    tariffCode?: number;
    deliveryModes?: number[];
    declaredValue?: number; // Объявленная стоимость заказа (рубли)
    phoneNumber?: string; // Номер телефона для SMS уведомления
  }): Promise<{
    cost: number;
    currency: string;
    deliveryTimeMin: number;
    deliveryTimeMax: number;
  }> {
    const token = await this.getAccessToken();

    // Формируем to_location: согласно документации CDEK, при использовании postal_code
    // рекомендуется также указывать country_code, region и city для точной идентификации
    const toLocation: any = {
      country_code: 'RU', // Всегда указываем код страны
    };
    
    if (params.toLocation.postalCode) {
      toLocation.postal_code = params.toLocation.postalCode;
    }
    
    if (params.toLocation.city) {
      toLocation.city = params.toLocation.city;
    }
    
    if (params.toLocation.region) {
      toLocation.region = params.toLocation.region;
    }
    
    if (params.toLocation.address) {
      toLocation.address = params.toLocation.address;
    }
    
    // Проверяем, что есть хотя бы postal_code или city
    if (!toLocation.postal_code && !toLocation.city) {
      throw new Error('CDEK: Either postal_code or city must be provided for to_location');
    }

    // Формируем тело запроса согласно документации CDEK API
    const requestBody: any = {
      type: 1, // Тип расчета: 1 - доставка
      currency: 1, // Валюта: 1 - RUB
      lang: 'rus', // Язык ответа
      from_location: {
        postal_code: params.fromLocation.postalCode,
        country_code: 'RU', // Добавляем код страны для точности
      },
      to_location: toLocation,
      packages: params.packages.map(pkg => ({
        weight: Math.round(pkg.weight), // CDEK требует вес в граммах (целое число)
        length: Math.round(pkg.length || 10), // Размеры в см (целые числа)
        width: Math.round(pkg.width || 10),
        height: Math.round(pkg.height || 10),
      })),
    };

    if (params.fromLocation.city) {
      requestBody.from_location.city = params.fromLocation.city;
    }

    if (params.fromLocation.region) {
      requestBody.from_location.region = params.fromLocation.region;
    }

    if (params.fromLocation.address) {
      requestBody.from_location.address = params.fromLocation.address;
    }


    // Добавляем tariff_code только если указан (опциональный параметр)
    if (params.tariffCode) {
      requestBody.tariff_code = params.tariffCode;
    }

    // Формируем массив дополнительных услуг
    const services: Array<{ code: string; parameter: string }> = [];
    
    // Добавляем объявленную стоимость (страхование) если указана
    if (params.declaredValue !== undefined && params.declaredValue > 0) {
      services.push({
        code: 'INSURANCE',
        parameter: Math.round(params.declaredValue).toString() // Объявленная стоимость в рублях (строка)
      });
    }
    
    // Добавляем SMS уведомление если указан номер телефона
    if (params.phoneNumber) {
      services.push({
        code: 'SMS',
        parameter: params.phoneNumber // Номер телефона для SMS (строка)
      });
    }
    
    // Определяем эндпоинт: если есть услуги, используем tariffAndService, иначе tarifflist
    const hasServices = services.length > 0;
    const endpoint = hasServices 
      ? '/v2/calculator/tariffAndService' 
      : '/v2/calculator/tarifflist';
    
    // Добавляем services только если есть хотя бы одна услуга
    if (hasServices) {
      requestBody.services = services;
    }

    // Функция для выполнения запроса с retry логикой для временных ошибок
    const makeRequest = async (attempt: number = 1): Promise<Response> => {
      const response = await fetch(`${this.apiUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Если получили временную ошибку (502, 503, 504) и еще есть попытки, повторяем
      if (!response.ok && (response.status === 502 || response.status === 503 || response.status === 504) && attempt < 3) {
        const delay = attempt * 500; // Экспоненциальная задержка: 500ms, 1000ms
        console.warn(`[CdekService] Temporary error ${response.status}, retrying in ${delay}ms (attempt ${attempt}/2)...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return makeRequest(attempt + 1);
      }

      return response;
    };

    const response = await makeRequest();

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText || 'Unknown error');
      console.error('[CdekService] CDEK API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        requestBody: JSON.stringify(requestBody),
      });
      throw new Error(`CDEK calculation error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // Проверяем структуру ответа
    if (!data) {
      throw new Error('CDEK: Empty response from API');
    }

    // Для tariffAndService ответ имеет структуру: { tariff_codes: [{ tariff_code, status, result: {...} }, ...] }
    // Для tarifflist ответ имеет структуру: { tariff_codes: [{ tariff_code, tariff_name, delivery_mode, ... }, ...] } или массив
    
    let tariffs: any[] = [];
    if (Array.isArray(data)) {
      // Ответ - массив тарифов
      tariffs = data;
    } else if (data.tariff_codes && Array.isArray(data.tariff_codes)) {
      // CDEK API v2 возвращает объект с полем tariff_codes
      // Для tariffAndService каждый элемент имеет структуру { tariff_code, status, result: {...} }
      // Для tarifflist каждый элемент имеет структуру { tariff_code, tariff_name, delivery_mode, ... }
      
      if (hasServices) {
        // Для tariffAndService извлекаем result из каждого элемента
        tariffs = data.tariff_codes
          .filter((item: any) => item.result) // Фильтруем только элементы с result
          .map((item: any) => ({
            ...item.result, // Распаковываем result
            tariff_code: item.tariff_code, // Сохраняем tariff_code для идентификации
            status: item.status
          }));
      } else {
        // ??? tarifflist ?????????? ???????? ??? ????
        tariffs = data.tariff_codes;
      }
    } else if (data.tariffs && Array.isArray(data.tariffs)) {
      tariffs = data.tariffs;
    } else if (data.tariff) {
      // Если один тариф в объекте
      tariffs = [data.tariff];
    } else {
      console.error('[CdekService] Unexpected response structure:', JSON.stringify(data));
      throw new Error('CDEK: Unexpected response structure');
    }
    
    if (tariffs.length === 0) {
      throw new Error('CDEK: No tariffs available');
    }

    // Выбираем тариф из списка

    const preferredModes = (params.deliveryModes || [])
      .map((mode) => parseInt(String(mode), 10))
      .filter((mode) => Number.isFinite(mode));

    const filterByModes = (list: any[]) => {
      if (preferredModes.length === 0) {
        return list;
      }
      return list.filter((item: any) => {
        const mode = parseInt(String(item.delivery_mode), 10);
        return preferredModes.includes(mode);
      });
    };
    let tariff: any;

    const pickCheapest = (list: any[], preferTotal: boolean) => {
      if (!list || list.length === 0) {
        return null;
      }
      const sorted = list.sort((a: any, b: any) => {
        const costA = preferTotal
          ? (a.total_sum ?? a.delivery_sum ?? 0)
          : (a.delivery_sum ?? a.total_sum ?? 0);
        const costB = preferTotal
          ? (b.total_sum ?? b.delivery_sum ?? 0)
          : (b.delivery_sum ?? b.total_sum ?? 0);
        return costA - costB;
      });
      return sorted[0];
    };

    if (hasServices) {
      const filtered = filterByModes(tariffs);
      tariff = pickCheapest(filtered.length > 0 ? filtered : tariffs, true);
    } else if (preferredModes.length > 0) {
      const filtered = filterByModes(tariffs);
      tariff = pickCheapest(filtered.length > 0 ? filtered : tariffs, false);
    } else {
      const pvzDeliveryModes = [4, 7];
      const pvzTariffs = tariffs.filter((t: any) => {
        const mode = parseInt(String(t.delivery_mode), 10);
        return pvzDeliveryModes.includes(mode);
      });

      const candidates = pvzTariffs.length > 0 ? pvzTariffs : tariffs;
      tariff = pickCheapest(candidates, false) || tariffs[0];
    }

    const totalSum = hasServices ? (tariff.total_sum ?? tariff.delivery_sum) : (tariff.delivery_sum ?? tariff.total_sum);
    
    if (totalSum === undefined || totalSum === null) {
      console.error('[CdekService] Tariff response missing cost field:', JSON.stringify(tariff));
      throw new Error('CDEK: Tariff response missing cost field');
    }

    // CDEK API v2: delivery_sum и total_sum возвращаются в рублях
    const cost = parseFloat(totalSum);
    
    return {
      cost: cost,
      currency: tariff.currency || 'RUB',
      deliveryTimeMin: tariff.period_min || tariff.delivery_time_min || 0,
      deliveryTimeMax: tariff.period_max || tariff.delivery_time_max || 0,
    };
  }
}
