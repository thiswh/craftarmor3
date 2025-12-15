/**
 * Сервис для работы с API Почты России
 */
import { DeliveryPoint } from '../DeliveryPointRepository.js';

export class RussianPostService {
  private token: string;
  private key: string;
  private readonly otpravkaApiUrl: string;
  private readonly tariffApiUrl: string;

  constructor() {
    this.otpravkaApiUrl = process.env.RUSPOST_API_URL || 'https://otpravka-api.pochta.ru';
    this.tariffApiUrl = process.env.RUSPOST_TARIFF_URL || 'https://tariff.pochta.ru';
    this.token = process.env.RUSPOST_TOKEN || '';
    this.key = process.env.RUSPOST_KEY || '';
    
    if (!this.token || !this.key) {
      throw new Error('RUSPOST_TOKEN and RUSPOST_KEY must be set in environment variables');
    }
  }

  /**
   * Получение списка пунктов выдачи (отделений)
   */
  async getDeliveryPoints(): Promise<DeliveryPoint[]> {
    // API Почты России для получения списка отделений
    // Используем базовую авторизацию
    const auth = Buffer.from(`${this.token}:${this.key}`).toString('base64');

    const response = await fetch(`${this.otpravkaApiUrl}/1.0/postoffice`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Russian Post API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Преобразуем данные Почты России в наш формат
    return data.map((point: any) => ({
      serviceCode: 'russianpost',
      externalId: point.postalCode || point.index || String(point.id),
      latitude: parseFloat(point.coordinates?.latitude || '0'),
      longitude: parseFloat(point.coordinates?.longitude || '0'),
      address: point.address || '',
      city: point.city || '',
      region: point.region || '',
      postalCode: point.postalCode || point.index || '',
      name: point.name || point.description || '',
      schedule: point.workHours || null,
      metadata: {
        type: point.type,
        index: point.index,
      },
      isActive: true,
    }));
  }

  /**
   * Расчет стоимости доставки
   */
  async calculateDelivery(params: {
    fromPostalCode: string;
    toPostalCode: string;
    weight: number; // в граммах
    mailType: number; // тип отправления (1 - письмо, 2 - посылка и т.д.)
    declaredValue?: number; // объявленная ценность
  }): Promise<{
    cost: number;
    currency: string;
    deliveryTimeMin: number;
    deliveryTimeMax: number;
  }> {
    // API для расчета тарифа
    const url = new URL(`${this.tariffApiUrl}/v1/calculate/tariff/delivery`);
    url.searchParams.append('object', String(params.mailType));
    url.searchParams.append('from', params.fromPostalCode);
    url.searchParams.append('to', params.toPostalCode);
    url.searchParams.append('weight', String(params.weight));
    
    if (params.declaredValue) {
      url.searchParams.append('sumoc', String(params.declaredValue * 100)); // в копейках
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Russian Post tariff calculation error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      cost: parseFloat(data.totalRate) / 100, // в копейках, переводим в рубли
      currency: 'RUB',
      deliveryTimeMin: data.deliveryTime?.min || 0,
      deliveryTimeMax: data.deliveryTime?.max || 0,
    };
  }
}


