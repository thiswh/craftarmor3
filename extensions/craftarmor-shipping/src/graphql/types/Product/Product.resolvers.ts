/**
 * Product dimension resolvers with request-scoped batch loading.
 */
import { pool } from '@evershop/evershop/lib/postgres';

type Dimensions = {
  length: number | null;
  width: number | null;
  height: number | null;
};

type DimensionsLoader = {
  load: (productId: number) => Promise<Dimensions>;
};

type DbPool = {
  query: (sql: string, params: unknown[]) => Promise<{ rows: any[] }>;
};

function createDimensionsLoader(dbPool: DbPool): DimensionsLoader {
  const pending = new Map<
    number,
    { resolve: (value: Dimensions) => void; reject: (error: unknown) => void }
  >();
  const resultCache = new Map<number, Promise<Dimensions>>();
  let scheduled = false;

  const flush = async () => {
    scheduled = false;
    const ids = Array.from(pending.keys());
    if (ids.length === 0) {
      return;
    }

    const callbacks = new Map(pending);
    pending.clear();

    try {
      const result = await dbPool.query(
        'SELECT product_id, length, width, height FROM product WHERE product_id = ANY($1)',
        [ids]
      );

      const rowsMap = new Map<number, Dimensions>();
      result.rows.forEach((row: any) => {
        rowsMap.set(Number(row.product_id), {
          length: row.length ? parseFloat(row.length) : null,
          width: row.width ? parseFloat(row.width) : null,
          height: row.height ? parseFloat(row.height) : null
        });
      });

      ids.forEach((id) => {
        const dims = rowsMap.get(id) || { length: null, width: null, height: null };
        callbacks.get(id)?.resolve(dims);
      });
    } catch (error) {
      ids.forEach((id) => callbacks.get(id)?.reject(error));
    }
  };

  return {
    load(productId: number) {
      if (resultCache.has(productId)) {
        return resultCache.get(productId)!;
      }

      const promise = new Promise<Dimensions>((resolve, reject) => {
        pending.set(productId, { resolve, reject });
        if (!scheduled) {
          scheduled = true;
          setImmediate(flush);
        }
      });

      resultCache.set(productId, promise);
      return promise;
    }
  };
}

function getDimensionsLoader(context: any): DimensionsLoader {
  if (!context.__productDimensionsLoader) {
    context.__productDimensionsLoader = createDimensionsLoader(
      (context.pool as DbPool) || (pool as unknown as DbPool)
    );
  }
  return context.__productDimensionsLoader;
}

export default {
  Product: {
    length: async (product: any, _: unknown, context: any) => {
      try {
        if (product.length !== undefined) {
          return product.length ? parseFloat(product.length) : null;
        }

        const productId = product.productId ?? product.product_id;
        if (!productId) {
          return null;
        }

        const dimensions = await getDimensionsLoader(context).load(Number(productId));
        return dimensions.length;
      } catch (error) {
        console.error('[Product.resolvers] Error fetching length:', error);
        return null;
      }
    },

    width: async (product: any, _: unknown, context: any) => {
      try {
        if (product.width !== undefined) {
          return product.width ? parseFloat(product.width) : null;
        }

        const productId = product.productId ?? product.product_id;
        if (!productId) {
          return null;
        }

        const dimensions = await getDimensionsLoader(context).load(Number(productId));
        return dimensions.width;
      } catch (error) {
        console.error('[Product.resolvers] Error fetching width:', error);
        return null;
      }
    },

    height: async (product: any, _: unknown, context: any) => {
      try {
        if (product.height !== undefined) {
          return product.height ? parseFloat(product.height) : null;
        }

        const productId = product.productId ?? product.product_id;
        if (!productId) {
          return null;
        }

        const dimensions = await getDimensionsLoader(context).load(Number(productId));
        return dimensions.height;
      } catch (error) {
        console.error('[Product.resolvers] Error fetching height:', error);
        return null;
      }
    }
  }
};
