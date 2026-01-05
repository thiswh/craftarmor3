/**
 * Adds product_length/product_width/product_height to cart item fields.
 * Values are read from item.getProduct() (same flow as product_weight).
 */
export default function registerCartItemDimensions(fields: any[]) {
  return [
    ...fields,
    {
      key: 'product_length',
      resolvers: [
        async function(this: any) {
          const product = await this.getProduct();
          return product.length ? parseFloat(product.length) : null;
        }
      ]
    },
    {
      key: 'product_width',
      resolvers: [
        async function(this: any) {
          const product = await this.getProduct();
          return product.width ? parseFloat(product.width) : null;
        }
      ]
    },
    {
      key: 'product_height',
      resolvers: [
        async function(this: any) {
          const product = await this.getProduct();
          return product.height ? parseFloat(product.height) : null;
        }
      ]
    }
  ];
}
