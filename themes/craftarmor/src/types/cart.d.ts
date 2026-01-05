/**
 * TypeScript декларации для расширения типов корзины
 * Добавляет поля размеров товаров в CartItem и общие размеры корзины в CartData
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

  interface CartData {
    /**
     * Общая длина корзины в сантиметрах (рассчитывается на сервере)
     */
    totalLength?: number | null;
    
    /**
     * Общая ширина корзины в сантиметрах (рассчитывается на сервере)
     */
    totalWidth?: number | null;
    
    /**
     * Общая высота корзины в сантиметрах (рассчитывается на сервере)
     */
    totalHeight?: number | null;
  }
}
