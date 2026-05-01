/**
 * Adds product_length/product_width/product_height to cart item fields.
 * Prefer stored values from cart_item, fallback to product data.
 */
const parseStoredNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const parseStoredBoolean = (value: unknown): boolean => {
  if (value === null || value === undefined || value === '') {
    return true;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  const normalized = String(value).trim().toLowerCase();
  if (
    normalized === 'false' ||
    normalized === '0' ||
    normalized === 'no' ||
    normalized === 'f' ||
    normalized === 'off'
  ) {
    return false;
  }
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 't' || normalized === 'on') {
    return true;
  }
  return true;
};

const resolveStoredOrProduct = async (
  value: unknown,
  getter: (product: any) => unknown,
  context: any
): Promise<number | null> => {
  const stored = parseStoredNumber(value);
  if (stored !== null) {
    return stored;
  }
  const product = await context.getProduct();
  if (!product) {
    return null;
  }
  const productValue = parseStoredNumber(getter(product));
  return productValue;
};

export default function registerCartItemDimensions(fields: any[]) {
  const updatedFields = fields.map((field: any) => {
    if (field.key !== 'product_weight') {
      return field;
    }
    return {
      ...field,
      resolvers: [
        async function resolver(this: any, value: unknown) {
          return resolveStoredOrProduct(value, (product) => product.weight, this);
        }
      ]
    };
  });

  return [
    ...updatedFields,
    {
      key: 'is_selected',
      resolvers: [
        async function resolver(value: unknown) {
          return parseStoredBoolean(value);
        }
      ]
    },
    {
      key: 'product_length',
      resolvers: [
        async function resolver(this: any, value: unknown) {
          return resolveStoredOrProduct(value, (product) => product.length, this);
        }
      ]
    },
    {
      key: 'product_width',
      resolvers: [
        async function resolver(this: any, value: unknown) {
          return resolveStoredOrProduct(value, (product) => product.width, this);
        }
      ]
    },
    {
      key: 'product_height',
      resolvers: [
        async function resolver(this: any, value: unknown) {
          return resolveStoredOrProduct(value, (product) => product.height, this);
        }
      ]
    }
  ];
}
