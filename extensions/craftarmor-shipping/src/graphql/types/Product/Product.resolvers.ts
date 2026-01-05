/**
 * GraphQL resolvers для расширения типа Product
 * Добавляет поддержку полей размеров (length, width, height)
 */
import { pool } from '@evershop/evershop/lib/postgres';

export default {
  Product: {
    length: async (product: any, _, context: any) => {
      try {
        // Если размеры уже есть в объекте product (из базового запроса), возвращаем их
        const productId = product.productId || product.uuid;
        if (product.length !== undefined) {
          console.log('[Product.resolvers] length from product object', {
            productId,
            length: product.length
          });
          return product.length ? parseFloat(product.length) : null;
        }
        console.log('[Product.resolvers] length from DB', { productId });
        
        // Иначе загружаем из БД
        const result = await pool.query(
          'SELECT length FROM product WHERE product_id = $1',
          [productId]
        );
        
        if (result.rows.length > 0 && result.rows[0].length) {
          return parseFloat(result.rows[0].length);
        }
        
        return null;
      } catch (error) {
        console.error('[Product.resolvers] Error fetching length:', error);
        return null;
      }
    },
    
    width: async (product: any, _, context: any) => {
      try {
        // Если размеры уже есть в объекте product (из базового запроса), возвращаем их
        const productId = product.productId || product.uuid;
        if (product.width !== undefined) {
          console.log('[Product.resolvers] width from product object', {
            productId,
            width: product.width
          });
          return product.width ? parseFloat(product.width) : null;
        }
        console.log('[Product.resolvers] width from DB', { productId });
        
        // Иначе загружаем из БД
        const result = await pool.query(
          'SELECT width FROM product WHERE product_id = $1',
          [productId]
        );
        
        if (result.rows.length > 0 && result.rows[0].width) {
          return parseFloat(result.rows[0].width);
        }
        
        return null;
      } catch (error) {
        console.error('[Product.resolvers] Error fetching width:', error);
        return null;
      }
    },
    
    height: async (product: any, _, context: any) => {
      try {
        // Если размеры уже есть в объекте product (из базового запроса), возвращаем их
        const productId = product.productId || product.uuid;
        if (product.height !== undefined) {
          console.log('[Product.resolvers] height from product object', {
            productId,
            height: product.height
          });
          return product.height ? parseFloat(product.height) : null;
        }
        console.log('[Product.resolvers] height from DB', { productId });
        
        // Иначе загружаем из БД
        const result = await pool.query(
          'SELECT height FROM product WHERE product_id = $1',
          [productId]
        );
        
        if (result.rows.length > 0 && result.rows[0].height) {
          return parseFloat(result.rows[0].height);
        }
        
        return null;
      } catch (error) {
        console.error('[Product.resolvers] Error fetching height:', error);
        return null;
      }
    }
  }
};
