import { calculateCartDimensions } from './cartDimensions.js';

const cartDimensionsCache = new WeakMap<object, { length: number; width: number; height: number }>();

function getCartDimensions(cart: any): { length: number; width: number; height: number } {
  if (cartDimensionsCache.has(cart)) {
    return cartDimensionsCache.get(cart)!;
  }
  const items = cart.getItems();
  const mappedItems = items.map((item: any) => ({
    length: parseFloat(item.getData('product_length')) || 0,
    width: parseFloat(item.getData('product_width')) || 0,
    height: parseFloat(item.getData('product_height')) || 0,
    qty: parseInt(item.getData('qty'), 10) || 1
  }));
  const dimensions = calculateCartDimensions(mappedItems);
  cartDimensionsCache.set(cart, dimensions);
  return dimensions;
}

export default function registerCartDimensionsFields(fields: any[]) {
  return [
    ...fields,
    {
      key: 'total_length',
      resolvers: [
        async function resolver() {
          const dimensions = getCartDimensions(this);
          return dimensions.length;
        }
      ],
      dependencies: ['items']
    },
    {
      key: 'total_width',
      resolvers: [
        async function resolver() {
          const dimensions = getCartDimensions(this);
          return dimensions.width;
        }
      ],
      dependencies: ['items']
    },
    {
      key: 'total_height',
      resolvers: [
        async function resolver() {
          const dimensions = getCartDimensions(this);
          return dimensions.height;
        }
      ],
      dependencies: ['items']
    }
  ];
}
