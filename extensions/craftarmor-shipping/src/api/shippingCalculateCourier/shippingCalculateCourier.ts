import { Request, Response } from 'express';
import { select } from '@evershop/postgres-query-builder';
import { getConfig } from '@evershop/evershop/lib/util/getConfig';
import { pool } from '@evershop/evershop/lib/postgres';
import { CdekService } from '../../services/cdek/CdekService.js';
import {
  calculateCartDimensions,
  DEFAULT_CART_DIMENSIONS
} from '../../services/cartDimensions.js';

const COURIER_METHOD_UUID = '1ad1dde4-0b52-4fb9-965f-8c3b5be739e7';

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

const normalizeDeliveryType = (value: any) =>
  value === 'pickup' ? 'pickup' : 'courier';

const buildAddressLine = (primary?: string, secondary?: string) => {
  const trimmedPrimary = String(primary || '').trim();
  const trimmedSecondary = String(secondary || '').trim();
  if (trimmedPrimary && trimmedSecondary) {
    return `${trimmedPrimary}, ${trimmedSecondary}`;
  }
  return trimmedPrimary || trimmedSecondary;
};

export default async function shippingCalculateCourier(
  request: Request,
  response: Response
) {
  try {
    const cartId = String(request.params.cart_id || '');
    const methodId = String(request.params.method_id || '');

    if (!cartId || !methodId) {
      response.statusCode = 200;
      response.$body = {
        success: false,
        message: 'Required params: cart_id, method_id',
        data: { cost: 0 }
      };
      return;
    }

    if (methodId !== COURIER_METHOD_UUID) {
      response.statusCode = 200;
      response.$body = {
        success: false,
        message: `Unknown method_id: ${methodId}`,
        data: { cost: 0 }
      };
      return;
    }

    const cart = await select()
      .from('cart')
      .where('uuid', '=', cartId)
      .and('status', '=', true)
      .load(pool);

    if (!cart) {
      response.statusCode = 200;
      response.$body = {
        success: false,
        message: 'Cart not found for this session',
        data: { cost: 0 }
      };
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

    if (invalidItems.length > 0) {
      response.statusCode = 200;
      response.$body = {
        success: false,
        message: 'Some items are unavailable or missing weight.',
        data: {
          cost: 0,
          invalid_items: invalidItems
        }
      };
      return;
    }

    const shippingAddressId = cart.shipping_address_id;
    if (!shippingAddressId) {
      response.statusCode = 200;
      response.$body = {
        success: false,
        message: 'Shipping address is not selected',
        data: { cost: 0 }
      };
      return;
    }

    const shippingAddress = await select()
      .from('cart_address')
      .where('cart_address_id', '=', shippingAddressId)
      .load(pool);

    if (!shippingAddress) {
      response.statusCode = 200;
      response.$body = {
        success: false,
        message: 'Shipping address is not available',
        data: { cost: 0 }
      };
      return;
    }

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

    if (addressDeliveryType !== 'courier') {
      response.statusCode = 200;
      response.$body = {
        success: false,
        message: 'Shipping address type does not match selected method',
        data: { cost: 0 }
      };
      return;
    }

    const weightKg = getWeightInKg(items);
    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      response.statusCode = 200;
      response.$body = {
        success: false,
        message: 'Cart weight is required for calculation',
        data: { cost: 0 }
      };
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

    const destinationAddress = buildAddressLine(
      shippingAddress.address_1 || shippingAddress.address1,
      shippingAddress.address_2 || shippingAddress.address2
    );
    const destination = {
      postalCode: shippingAddress.postcode || shippingAddress.postal_code || '',
      city: toText(shippingAddress.city),
      address: destinationAddress,
      region: toText(shippingAddress.province) || shippingAddress.region || ''
    };

    if (!destination.postalCode) {
      response.statusCode = 200;
      response.$body = {
        success: false,
        message: 'Destination postal code is required',
        data: { cost: 0 }
      };
      return;
    }

    if (!destination.address) {
      response.statusCode = 200;
      response.$body = {
        success: false,
        message: 'Destination address is required',
        data: { cost: 0 }
      };
      return;
    }

    const senderPostalCode = process.env.SHOP_SENDER_POSTAL || '';
    const senderCity = process.env.SHOP_SENDER_CITY || '';
    if (!senderPostalCode) {
      response.statusCode = 200;
      response.$body = {
        success: false,
        message: 'Shop sender postal code not configured',
        data: { cost: 0 }
      };
      return;
    }

    const tariffCodeRaw = process.env.CDEK_COURIER_TARIFF_CODE || '';
    const tariffCode = parseInt(tariffCodeRaw, 10);
    const hasTariffCode = Number.isFinite(tariffCode) && tariffCode > 0;

    let result: {
      cost: number;
      currency: string;
      deliveryTimeMin: number;
      deliveryTimeMax: number;
    };

    try {
      const cdekService = CdekService.getInstance();
      const calcParams: any = {
        fromLocation: {
          postalCode: senderPostalCode,
          city: senderCity || undefined
        },
        toLocation: {
          postalCode: destination.postalCode,
          city: destination.city || undefined,
          address: destination.address,
          region: destination.region || undefined
        },
        packages: [
          {
            weight: weightGrams,
            length,
            width,
            height
          }
        ],
        deliveryModes: [3]
      };

      if (hasTariffCode) {
        calcParams.tariffCode = tariffCode;
      }

      result = await cdekService.calculateDelivery(calcParams);
    } catch (calcError: any) {
      console.error('[shippingCalculateCourier] Calculation error:', calcError);
      response.statusCode = 200;
      response.$body = {
        success: false,
        message:
          calcError?.message ||
          'Shipping service is unavailable. Please try again later.',
        data: {
          cost: 0
        }
      };
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
    console.error('[shippingCalculateCourier] Error:', error);
    response.$body = {
      success: false,
      message: 'Internal server error',
      data: {
        cost: 0
      },
      error: error.message
    };
  }
}
