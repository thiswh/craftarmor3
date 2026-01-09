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
