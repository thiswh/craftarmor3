import { getConfig } from '@evershop/evershop/lib/util/getConfig';
import { getSetting } from '@evershop/evershop/setting/services';

export interface YookassaPaymentAmount {
  value: string;
  currency: string;
}

export interface YookassaPaymentConfirmation {
  type?: string;
  confirmation_url?: string | null;
}

export interface YookassaPayment {
  id: string;
  status: string;
  paid?: boolean;
  amount: YookassaPaymentAmount;
  confirmation?: YookassaPaymentConfirmation;
  description?: string;
  metadata?: Record<string, unknown>;
}

interface YookassaCredentials {
  shopId: string;
  secretKey: string;
  apiUrl: string;
}

const DEFAULT_API_URL = 'https://api.yookassa.ru/v3';

const asText = (value: unknown) => String(value ?? '').trim();

const parseMaybeJson = (payload: string): any => {
  if (!payload) {
    return null;
  }
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
};

export class YookassaService {
  private static instance: YookassaService | null = null;

  static getInstance() {
    if (!this.instance) {
      this.instance = new YookassaService();
    }
    return this.instance;
  }

  private async resolveCredentials(): Promise<YookassaCredentials> {
    const config = getConfig('system.yookassa', {}) as Record<string, unknown>;

    const shopId =
      asText(config.shopId) ||
      asText(config.shop_id) ||
      asText(process.env.YOOKASSA_SHOP_ID) ||
      asText(await getSetting('yookassaShopId', ''));

    const secretKey =
      asText(config.secretKey) ||
      asText(config.secret_key) ||
      asText(process.env.YOOKASSA_SECRET_KEY) ||
      asText(await getSetting('yookassaSecretKey', ''));

    const apiUrl =
      asText(config.apiUrl) ||
      asText(config.api_url) ||
      asText(process.env.YOOKASSA_API_URL) ||
      DEFAULT_API_URL;

    if (!shopId || !secretKey) {
      throw new Error('YooKassa credentials are not configured');
    }

    return {
      shopId,
      secretKey,
      apiUrl: apiUrl.replace(/\/+$/, '')
    };
  }

  private async request<T>({
    method,
    path,
    body,
    idempotenceKey
  }: {
    method: 'GET' | 'POST';
    path: string;
    body?: Record<string, unknown>;
    idempotenceKey?: string;
  }): Promise<T> {
    const { shopId, secretKey, apiUrl } = await this.resolveCredentials();
    const auth = Buffer.from(`${shopId}:${secretKey}`).toString('base64');
    const headers: Record<string, string> = {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json'
    };

    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
    }
    if (idempotenceKey) {
      headers['Idempotence-Key'] = idempotenceKey;
    }

    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const rawText = await response.text();
    const parsed = parseMaybeJson(rawText);

    if (!response.ok) {
      const details = parsed ? JSON.stringify(parsed) : rawText || response.statusText;
      throw new Error(`YooKassa API error ${response.status}: ${details}`);
    }

    return (parsed ?? {}) as T;
  }

  async createPayment(
    payload: Record<string, unknown>,
    idempotenceKey: string
  ): Promise<YookassaPayment> {
    if (!idempotenceKey) {
      throw new Error('Idempotence key is required');
    }
    return this.request<YookassaPayment>({
      method: 'POST',
      path: '/payments',
      body: payload,
      idempotenceKey
    });
  }

  async getPayment(paymentId: string): Promise<YookassaPayment> {
    const normalizedPaymentId = asText(paymentId);
    if (!normalizedPaymentId) {
      throw new Error('paymentId is required');
    }
    return this.request<YookassaPayment>({
      method: 'GET',
      path: `/payments/${encodeURIComponent(normalizedPaymentId)}`
    });
  }
}
