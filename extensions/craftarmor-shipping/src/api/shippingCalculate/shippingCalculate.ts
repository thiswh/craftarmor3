import { Request, Response } from 'express';
import { select } from '@evershop/postgres-query-builder';
import { getConfig } from '@evershop/evershop/lib/util/getConfig';
import { pool } from '@evershop/evershop/lib/postgres';
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

export default async function shippingCalculate(
  request: Request,
  response: Response
) {
  try {
    const cartId = String(request.params.cart_id || '');
    const methodId = String(request.params.method_id || '');

    if (!cartId || !methodId) {
      response.statusCode = 400;
      response.$body = {
        success: false,
        message: 'Required params: cart_id, method_id'
      };
      return;
    }

    const serviceCode = METHOD_SERVICE_CODE[methodId];
    if (!serviceCode) {
      response.statusCode = 400;
      response.$body = {
        success: false,
        message: `Unknown method_id: ${methodId}`
      };
      return;
    }

    const cart = await select()
      .from('cart')
      .where('uuid', '=', cartId)
      .and('status', '=', true)
      .load(pool);

    if (!cart) {
      response.$body = { success: true, data: { cost: 0 } };
      return;
    }

    const shippingAddressId = cart.shipping_address_id;
    if (!shippingAddressId) {
      response.$body = { success: true, data: { cost: 0 } };
      return;
    }

    const shippingAddress = await select()
      .from('cart_address')
      .where('cart_address_id', '=', shippingAddressId)
      .load(pool);

    if (!shippingAddress) {
      response.$body = { success: true, data: { cost: 0 } };
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

    const missingItems = items.filter((item) => {
      if (item.product_exists) {
        return false;
      }
      const hasWeight = toNumber(item.product_weight) > 0;
      const hasDimensions =
        toNumber(item.product_length) > 0 ||
        toNumber(item.product_width) > 0 ||
        toNumber(item.product_height) > 0;
      return !hasWeight && !hasDimensions;
    });
    if (missingItems.length > 0) {
      response.$body = {
        success: false,
        message: 'Some items are unavailable.',
        data: {
          cost: 0
        }
      };
      return;
    }

    const weightKg = getWeightInKg(items);
    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      response.$body = { success: true, data: { cost: 0 } };
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
      response.statusCode = 500;
      response.$body = {
        success: false,
        message: 'Shop sender postal code not configured'
      };
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
          response.$body = { success: true, data: { cost: 0 } };
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
          response.$body = { success: true, data: { cost: 0 } };
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
          response.$body = { success: true, data: { cost: 0 } };
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
      response.$body = {
        success: false,
        message: calcError.message || 'Shipping calculation failed',
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
    console.error('[shippingCalculate] Error:', error);
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
