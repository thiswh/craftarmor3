function calculateCartDimensions(items: any[]): { length: number; width: number; height: number } {
  if (!items || items.length === 0) {
    return { length: 18, width: 20, height: 5 };
  }

  const itemsWithDimensions: Array<{ d1: number; d2: number; d3: number; qty: number }> = [];

  items.forEach((item) => {
    const length = parseFloat(item.getData('product_length')) || 0;
    const width = parseFloat(item.getData('product_width')) || 0;
    const height = parseFloat(item.getData('product_height')) || 0;
    const qty = parseInt(item.getData('qty'), 10) || 1;

    if (length <= 0 && width <= 0 && height <= 0) {
      return;
    }

    const sorted = [length, width, height].sort((a, b) => b - a);
    itemsWithDimensions.push({
      d1: sorted[0],
      d2: sorted[1],
      d3: sorted[2],
      qty
    });
  });

  if (itemsWithDimensions.length === 0) {
    return { length: 18, width: 20, height: 5 };
  }

  let variantA = {
    length: 0,
    width: 0,
    height: 0
  };
  itemsWithDimensions.forEach((item) => {
    variantA.length = Math.max(variantA.length, item.d2);
    variantA.width = Math.max(variantA.width, item.d3);
    variantA.height += item.d1 * item.qty;
  });
  const volumeA = variantA.length * variantA.width * variantA.height;

  let variantB = {
    length: 0,
    width: 0,
    height: 0
  };
  itemsWithDimensions.forEach((item) => {
    variantB.length = Math.max(variantB.length, item.d1);
    variantB.width = Math.max(variantB.width, item.d3);
    variantB.height += item.d2 * item.qty;
  });
  const volumeB = variantB.length * variantB.width * variantB.height;

  let variantC = {
    length: 0,
    width: 0,
    height: 0
  };
  itemsWithDimensions.forEach((item) => {
    variantC.length = Math.max(variantC.length, item.d1);
    variantC.width = Math.max(variantC.width, item.d2);
    variantC.height += item.d3 * item.qty;
  });
  const volumeC = variantC.length * variantC.width * variantC.height;

  let bestVariant = variantA;
  if (volumeB < volumeA && volumeB < volumeC) {
    bestVariant = variantB;
  } else if (volumeC < volumeA) {
    bestVariant = variantC;
  }

  const padding = 1.5;
  return {
    length: Math.ceil(bestVariant.length + padding),
    width: Math.ceil(bestVariant.width + padding),
    height: Math.ceil(bestVariant.height + padding)
  };
}

const cartDimensionsCache = new WeakMap<object, { length: number; width: number; height: number }>();

function getCartDimensions(cart: any): { length: number; width: number; height: number } {
  if (cartDimensionsCache.has(cart)) {
    return cartDimensionsCache.get(cart)!;
  }
  const items = cart.getItems();
  const dimensions = calculateCartDimensions(items);
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
