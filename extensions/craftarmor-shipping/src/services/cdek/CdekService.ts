/**
 * Сервис для работы с API CDEK
 */
import { DeliveryPoint } from '../DeliveryPointRepository.js';

export class CdekService {
  private clientId: string;
  private clientSecret: string;
  private accessToken?: string;
  private tokenExpiresAt?: Date;
  private readonly apiUrl = 'https://api.cdek.ru';

  constructor() {
    this.clientId = process.env.CDEK_CLIENT_ID || '';
    this.clientSecret = process.env.CDEK_CLIENT_SECRET || '';
    
    if (!this.clientId || !this.clientSecret) {
      throw new Error('CDEK_CLIENT_ID and CDEK_CLIENT_SECRET must be set in environment variables');
    }
  }

  /**
   * Получение OAuth2 токена
   */
  private async getAccessToken(): Promise<string> {
    // Если токен еще действителен, возвращаем его
    if (this.accessToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
      return this.accessToken;
    }

    // Получаем новый токен
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
      throw new Error(`CDEK API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Преобразуем данные CDEK в наш формат
    return data.map((point: any) => ({
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
    fromLocation: { postalCode: string };
    toLocation: { postalCode?: string; city?: string; address?: string };
    packages: Array<{ weight: number; length?: number; width?: number; height?: number }>;
    tariffCode?: number;
  }): Promise<{
    cost: number;
    currency: string;
    deliveryTimeMin: number;
    deliveryTimeMax: number;
  }> {
    const token = await this.getAccessToken();

    const requestBody = {
      from_location: {
        postal_code: params.fromLocation.postalCode,
      },
      to_location: {
        postal_code: params.toLocation.postalCode,
        city: params.toLocation.city,
        address: params.toLocation.address,
      },
      packages: params.packages.map(pkg => ({
        weight: pkg.weight * 1000, // CDEK требует вес в граммах
        length: pkg.length || 10,
        width: pkg.width || 10,
        height: pkg.height || 10,
      })),
      tariff_code: params.tariffCode || 136, // По умолчанию "Посылка склад-склад"
    };

    const response = await fetch(`${this.apiUrl}/v2/calculator/tarifflist`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`CDEK calculation error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data || data.length === 0) {
      throw new Error('CDEK: No tariffs available');
    }

    // Берем первый доступный тариф
    const tariff = data[0];
    
    return {
      cost: parseFloat(tariff.total_sum) / 100, // CDEK возвращает в копейках
      currency: 'RUB',
      deliveryTimeMin: tariff.period_min || 0,
      deliveryTimeMax: tariff.period_max || 0,
    };
  }
}


