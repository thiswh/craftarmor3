/**
 * TypeScript декларации для расширения типов корзины
 * Добавляет поля размеров товаров в CartItem
 */
declare module '@components/frontStore/cart/CartContext' {
  interface CartItem {
    /**
     * Длина товара в сантиметрах
     */
    productLength?: number | null;
    
    /**
     * Ширина товара в сантиметрах
     */
    productWidth?: number | null;
    
    /**
     * Высота товара в сантиметрах
     */
    productHeight?: number | null;
  }
}
