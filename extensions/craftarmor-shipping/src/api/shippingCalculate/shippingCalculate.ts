import { Request, Response } from 'express';
import { select } from '@evershop/postgres-query-builder';
import { getConfig } from '@evershop/evershop/lib/util/getConfig';
import { pool } from '@evershop/evershop/lib/postgres';
import { getMyCart } from '@evershop/evershop/checkout/services';
import { CdekService } from '../../services/cdek/CdekService.js';
import { RussianPostService } from '../../services/russianpost/RussianPostService.js';
import { BoxberryService } from '../../services/boxberry/BoxberryService.js';
import {
  calculateCartDimensions,
  DEFAULT_CART_DIMENSIONS
} from '../../services/cartDimensions.js';

const METHOD_SERVICE_CODE: Record<string, 'cdek' | 'russianpost' | 'boxberry'> =
  {
    'd3d16c61-5acf-4cf7-93d9-258e753cd58b': 'cdek'
  };

const toNumber = (value: unknown): number => {
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const toText = (value: any): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    return value.code || value.name || '';
  }
  return '';
};

const getWeightInKg = (
  items: Array<{ product_weight?: number | null; qty?: number | string | null }>
): number => {
  const weightUnit = String(getConfig('shop.weightUnit', 'kg')).toLowerCase();
  let totalWeight = 0;
  items.forEach((item) => {
    const itemWeight = toNumber(item.product_weight);
    const qty = Math.max(1, parseInt(String(item.qty), 10) || 1);
    totalWeight += itemWeight * qty;
  });

  if (totalWeight <= 0) {
    return 0;
  }

  const grams = weightUnit === 'g' ? totalWeight : totalWeight * 1000;
  return grams / 1000;
};

const getPickupData = (shippingAddress: any) => {
  const raw = shippingAddress?.pickup_data ?? shippingAddress?.pickupData;
  if (!raw) {
    return null;
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }
  if (typeof raw === 'object') {
    return raw;
  }
  return null;
};

const readQueryValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return String(value[0] || '');
  }
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
};

const getSessionCartUuid = async (request: Request): Promise<string> => {
  const cookieName = getConfig('system.session.cookieName', 'sid');
  const sessionId =
    request.signedCookies?.[cookieName] ?? request.cookies?.[cookieName];
  if (!sessionId) {
    return '';
  }
  const sessionCart = await getMyCart(sessionId, undefined).catch(() => null);
  if (!sessionCart || typeof (sessionCart as any).getData !== 'function') {
    return '';
  }
  return String((sessionCart as any).getData('uuid') || '');
};

const isInternalEvershopAxiosRequest = (request?: Request): boolean => {
  if (!request) {
    return false;
  }
  const userAgent = String(request.headers['user-agent'] || '').toLowerCase();
  if (!userAgent.includes('axios/')) {
    return false;
  }
  const host = String(request.headers.host || '').toLowerCase();
  const ip = String((request as any).ip || '');
  return (
    host.startsWith('localhost:') ||
    host.startsWith('127.0.0.1:') ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip === '127.0.0.1'
  );
};

const setErrorResponse = (
  response: Response,
  statusCode: number,
  body: Record<string, any>
) => {
  const request = response.req as Request | undefined;
  const shouldForce200 =
    statusCode >= 400 && isInternalEvershopAxiosRequest(request);
  response.statusCode = shouldForce200 ? 200 : statusCode;
  response.$body = body;
};

export default async function shippingCalculate(
  request: Request,
  response: Response
) {
  try {
    const isInternalRequest = isInternalEvershopAxiosRequest(request);
    const cartId = String(request.params.cart_id || '');
    const methodId = String(request.params.method_id || '');
    const checkInvalidOnly =
      ['1', 'true', 'yes'].includes(
        readQueryValue((request as any)?.query?.check_invalid_only).toLowerCase()
      );

    if (!cartId || !methodId) {
      setErrorResponse(response, 400, {
        success: false,
        message: 'Required params: cart_id, method_id',
        data: { cost: 0 }
      });
      return;
    }

    if (!isInternalRequest) {
      const sessionCartUuid = await getSessionCartUuid(request);
      if (!sessionCartUuid) {
        setErrorResponse(response, 401, {
          success: false,
          message: 'Session is required',
          data: { cost: 0 }
        });
        return;
      }
      if (sessionCartUuid !== cartId) {
        setErrorResponse(response, 403, {
          success: false,
          message: 'Access denied for this cart',
          data: { cost: 0 }
        });
        return;
      }
    }

    const serviceCode = METHOD_SERVICE_CODE[methodId];
    if (!serviceCode) {
      setErrorResponse(response, 400, {
        success: false,
        message: `Unknown method_id: ${methodId}`,
        data: { cost: 0 }
      });
      return;
    }

    const cart = await select()
      .from('cart')
      .where('uuid', '=', cartId)
      .and('status', '=', true)
      .load(pool);

    if (!cart) {
      setErrorResponse(response, 404, {
        success: false,
        message: 'Cart not found for this session',
        data: { cost: 0 }
      });
      return;
    }

    const itemsResult = await pool.query(
      `
        SELECT
          ci.cart_item_id,
          ci.uuid,
          ci.product_id,
          ci.product_name,
          ci.product_sku,
          ci.qty,
          p.product_id AS product_exists,
          COALESCE(ci.product_weight, p.weight) AS product_weight,
          COALESCE(ci.product_length, p.length) AS product_length,
          COALESCE(ci.product_width, p.width) AS product_width,
          COALESCE(ci.product_height, p.height) AS product_height
        FROM cart_item ci
        LEFT JOIN product p ON p.product_id = ci.product_id
        WHERE ci.cart_id = $1
      `,
      [cart.cart_id]
    );

    const items = itemsResult.rows || [];

    const invalidItems = items
      .filter((item) => {
        const productMissing = !item.product_exists;
        const weightMissing = toNumber(item.product_weight) <= 0;
        return productMissing || weightMissing;
      })
      .map((item) => ({
        cart_item_id: item.cart_item_id,
        uuid: item.uuid,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        reason: !item.product_exists ? 'missing_product' : 'missing_weight'
      }));

    if (checkInvalidOnly) {
      response.$body = {
        success: true,
        data: {
          cost: 0,
          invalid_items: invalidItems
        }
      };
      return;
    }

    if (invalidItems.length > 0) {
      setErrorResponse(response, 422, {
        success: false,
        message: 'Some items are unavailable or missing weight.',
        data: {
          cost: 0,
          invalid_items: invalidItems
        }
      });
      return;
    }

    const shippingAddressId = cart.shipping_address_id;
    if (!shippingAddressId) {
      setErrorResponse(response, 400, {
        success: false,
        message: 'Shipping address is not selected',
        data: { cost: 0 }
      });
      return;
    }

    const shippingAddress = await select()
      .from('cart_address')
      .where('cart_address_id', '=', shippingAddressId)
      .load(pool);

    if (!shippingAddress) {
      setErrorResponse(response, 404, {
        success: false,
        message: 'Shipping address is not available',
        data: { cost: 0 }
      });
      return;
    }

    const normalizeDeliveryType = (value: any) =>
      value === 'pickup' ? 'pickup' : 'courier';
    const pickupMeta =
      shippingAddress.pickup_point_id ||
      shippingAddress.pickupPointId ||
      shippingAddress.pickup_data ||
      shippingAddress.pickupData ||
      shippingAddress.pickup_external_id ||
      shippingAddress.pickupExternalId;
    const rawDeliveryType =
      shippingAddress.delivery_type || shippingAddress.deliveryType;
    const addressDeliveryType = rawDeliveryType
      ? normalizeDeliveryType(rawDeliveryType)
      : pickupMeta
        ? 'pickup'
        : 'courier';
    const methodDeliveryType = serviceCode === 'cdek' ? 'pickup' : 'courier';
    if (addressDeliveryType !== methodDeliveryType) {
      setErrorResponse(response, 409, {
        success: false,
        message: 'Shipping address type does not match selected method',
        data: { cost: 0 }
      });
      return;
    }

    const weightKg = getWeightInKg(items);
    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      setErrorResponse(response, 422, {
        success: false,
        message: 'Cart weight is required for calculation',
        data: { cost: 0 }
      });
      return;
    }
    const weightGrams = Math.round(weightKg * 1000);

    const dimensionItems = items.map((item) => ({
      length: toNumber(item.product_length),
      width: toNumber(item.product_width),
      height: toNumber(item.product_height),
      qty: Math.max(1, parseInt(String(item.qty), 10) || 1)
    }));
    const { length, width, height } = calculateCartDimensions(
      dimensionItems,
      DEFAULT_CART_DIMENSIONS
    );

    const pickupData = getPickupData(shippingAddress);
    const destination = {
      postalCode:
        pickupData?.postal_code ||
        pickupData?.postalCode ||
        shippingAddress.postcode ||
        shippingAddress.postal_code ||
        '',
      city:
        pickupData?.city ||
        toText(shippingAddress.city),
      address:
        pickupData?.address ||
        shippingAddress.address_1 ||
        shippingAddress.address1 ||
        '',
      region:
        pickupData?.region ||
        toText(shippingAddress.province) ||
        shippingAddress.region ||
        ''
    };

    const senderPostalCode = process.env.SHOP_SENDER_POSTAL || '';
    if (!senderPostalCode) {
      setErrorResponse(response, 500, {
        success: false,
        message: 'Shop sender postal code not configured',
        data: { cost: 0 }
      });
      return;
    }

    let result: {
      cost: number;
      currency: string;
      deliveryTimeMin: number;
      deliveryTimeMax: number;
    };

    try {
      if (serviceCode === 'cdek') {
        if (!destination.postalCode && !destination.city) {
          setErrorResponse(response, 422, {
            success: false,
            message: 'Destination postal code or city is required',
            data: { cost: 0 }
          });
          return;
        }
        const cdekService = CdekService.getInstance();
        result = await cdekService.calculateDelivery({
          fromLocation: { postalCode: senderPostalCode },
          toLocation: {
            postalCode: destination.postalCode || undefined,
            city: destination.city || undefined,
            address: destination.address || undefined,
            region: destination.region || undefined
          },
          packages: [
            {
              weight: weightGrams,
              length,
              width,
              height
            }
          ]
        });
      } else if (serviceCode === 'russianpost') {
        if (!destination.postalCode) {
          setErrorResponse(response, 422, {
            success: false,
            message: 'Destination postal code is required',
            data: { cost: 0 }
          });
          return;
        }
        const ruspostService = new RussianPostService();
        result = await ruspostService.calculateDelivery({
          fromPostalCode: senderPostalCode,
          toPostalCode: destination.postalCode,
          weight: weightGrams,
          mailType: 2
        });
      } else {
        if (!destination.city) {
          setErrorResponse(response, 422, {
            success: false,
            message: 'Destination city is required',
            data: { cost: 0 }
          });
          return;
        }
        const boxberryService = new BoxberryService();
        result = await boxberryService.calculateDelivery({
          toCity: destination.city,
          weight: weightKg
        });
      }
    } catch (calcError: any) {
      console.error('[shippingCalculate] Calculation error:', calcError);
      setErrorResponse(response, 503, {
        success: false,
        message:
          calcError?.message ||
          'Shipping service is unavailable. Please try again later.',
        data: {
          cost: 0
        }
      });
      return;
    }

    response.$body = {
      success: true,
      data: {
        cost: result.cost,
        currency: result.currency,
        deliveryTimeMin: result.deliveryTimeMin,
        deliveryTimeMax: result.deliveryTimeMax
      }
    };
  } catch (error: any) {
    console.error('[shippingCalculate] Error:', error);
    setErrorResponse(response, 500, {
      success: false,
      message: 'Internal server error',
      data: {
        cost: 0
      },
      error: error.message
    });
  }
}
