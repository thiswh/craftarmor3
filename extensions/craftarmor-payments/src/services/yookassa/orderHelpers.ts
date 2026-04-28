import { getConfig } from '@evershop/evershop/lib/util/getConfig';

const asText = (value: unknown) => String(value ?? '').trim();

export const getCurrentCustomerFromRequest = (request: any) =>
  (typeof request?.getCurrentCustomer === 'function'
    ? request.getCurrentCustomer()
    : null) ||
  request?.currentCustomer ||
  request?.locals?.customer ||
  null;

export const getCurrentCustomerId = (customer: any): number | null => {
  const candidate =
    customer?.customerId ?? customer?.customer_id ?? customer?.id ?? null;
  if (candidate === null || candidate === undefined) {
    return null;
  }
  const normalized = parseInt(String(candidate), 10);
  return Number.isFinite(normalized) ? normalized : null;
};

export const orderBelongsToCustomer = (
  order: any,
  currentCustomer: any
): boolean => {
  const orderCustomerId = parseInt(String(order?.customer_id ?? ''), 10);
  const currentCustomerId = getCurrentCustomerId(currentCustomer);
  if (!Number.isFinite(orderCustomerId) || !currentCustomerId) {
    return false;
  }
  return orderCustomerId === currentCustomerId;
};

export const toYookassaAmount = (value: unknown): string => {
  const amount = parseFloat(String(value ?? '0'));
  const normalized = Number.isFinite(amount) ? amount : 0;
  return normalized.toFixed(2);
};

export const joinUrl = (baseUrl: string, pathname: string): string => {
  const normalizedBase = asText(baseUrl).replace(/\/+$/, '');
  const normalizedPath = `/${String(pathname || '').replace(/^\/+/, '')}`;
  return `${normalizedBase}${normalizedPath}`;
};

export const resolveStoreHomeUrl = (): string =>
  asText(getConfig('shop.homeUrl', '')) ||
  asText(process.env.SHOP_HOME_URL) ||
  'http://localhost:3000';

