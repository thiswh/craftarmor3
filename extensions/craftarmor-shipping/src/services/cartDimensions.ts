export interface CartDimensionItem {
  length: number;
  width: number;
  height: number;
  qty: number;
}

export interface CartDimensionsResult {
  length: number;
  width: number;
  height: number;
}

const toPositiveNumber = (value: string | undefined, fallback: number): number => {
  const parsed = parseFloat(value || '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const DEFAULT_CART_DIMENSIONS: CartDimensionsResult = {
  length: toPositiveNumber(process.env.DEFAULT_CART_LENGTH, 18),
  width: toPositiveNumber(process.env.DEFAULT_CART_WIDTH, 20),
  height: toPositiveNumber(process.env.DEFAULT_CART_HEIGHT, 5)
};

export const calculateCartDimensions = (
  items: CartDimensionItem[],
  fallback: CartDimensionsResult = DEFAULT_CART_DIMENSIONS
): CartDimensionsResult => {
  if (!items || items.length === 0) {
    return fallback;
  }

  const itemsWithDimensions: Array<{
    d1: number;
    d2: number;
    d3: number;
    qty: number;
  }> = [];

  items.forEach((item) => {
    const qty = Math.max(1, Math.floor(item.qty || 0));
    const rawLength = item.length || 0;
    const rawWidth = item.width || 0;
    const rawHeight = item.height || 0;
    const useFallback =
      rawLength <= 0 || rawWidth <= 0 || rawHeight <= 0;
    const length = useFallback ? fallback.length : rawLength;
    const width = useFallback ? fallback.width : rawWidth;
    const height = useFallback ? fallback.height : rawHeight;

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
    return fallback;
  }

  const variantA = { length: 0, width: 0, height: 0 };
  itemsWithDimensions.forEach((item) => {
    variantA.length = Math.max(variantA.length, item.d2);
    variantA.width = Math.max(variantA.width, item.d3);
    variantA.height += item.d1 * item.qty;
  });
  const volumeA = variantA.length * variantA.width * variantA.height;

  const variantB = { length: 0, width: 0, height: 0 };
  itemsWithDimensions.forEach((item) => {
    variantB.length = Math.max(variantB.length, item.d1);
    variantB.width = Math.max(variantB.width, item.d3);
    variantB.height += item.d2 * item.qty;
  });
  const volumeB = variantB.length * variantB.width * variantB.height;

  const variantC = { length: 0, width: 0, height: 0 };
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
};
