/**
 * Процессор для добавления полей размеров (length, width, height) в cart item
 * Использует cartItemFields processor для добавления полей
 * Поля хранятся в snake_case (product_length, product_width, product_height)
 * и автоматически конвертируются в camelCase (productLength, productWidth, productHeight) в GraphQL
 */
import { pool } from '@evershop/evershop/lib/postgres';

// Кэш для хранения загруженных размеров продуктов (оптимизация)
const dimensionsCache = new Map<string, { length: number | null; width: number | null; height: number | null }>();

async function getProductDimensions(productId: string | number): Promise<{ length: number | null; width: number | null; height: number | null }> {
  const cacheKey = String(productId);
  
  // Проверяем кэш
  if (dimensionsCache.has(cacheKey)) {
    return dimensionsCache.get(cacheKey)!;
  }

  try {
    // Загружаем все размеры одним запросом
    const result = await pool.query(
      'SELECT length, width, height FROM product WHERE product_id = $1',
      [productId]
    );

    const dimensions = {
      length: result.rows.length > 0 && result.rows[0].length ? parseFloat(result.rows[0].length) : null,
      width: result.rows.length > 0 && result.rows[0].width ? parseFloat(result.rows[0].width) : null,
      height: result.rows.length > 0 && result.rows[0].height ? parseFloat(result.rows[0].height) : null
    };

    console.log(`[registerCartItemDimensions] Product ${productId} dimensions:`, dimensions);
    console.log(`[registerCartItemDimensions] DB result rows:`, result.rows);

    // Сохраняем в кэш
    dimensionsCache.set(cacheKey, dimensions);
    
    return dimensions;
  } catch (error) {
    console.error('[registerCartItemDimensions] Error fetching product dimensions:', error);
    return { length: null, width: null, height: null };
  }
}

export default function registerCartItemDimensions(fields: any[]) {
  return [
    ...fields,
    {
      key: 'product_length',
      resolvers: [
        async function(this: any) {
          const productId = this.getData('product_id');
          if (!productId) return null;
          const dimensions = await getProductDimensions(productId);
          return dimensions.length;
        }
      ]
    },
    {
      key: 'product_width',
      resolvers: [
        async function(this: any) {
          const productId = this.getData('product_id');
          if (!productId) return null;
          const dimensions = await getProductDimensions(productId);
          return dimensions.width;
        }
      ]
    },
    {
      key: 'product_height',
      resolvers: [
        async function(this: any) {
          const productId = this.getData('product_id');
          if (!productId) return null;
          const dimensions = await getProductDimensions(productId);
          return dimensions.height;
        }
      ]
    }
  ];
}
