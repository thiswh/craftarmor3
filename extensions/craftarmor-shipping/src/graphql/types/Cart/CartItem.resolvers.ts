/**
 * GraphQL resolvers для расширения типа CartItem
 * Поля productLength, productWidth, productHeight уже добавлены через процессор cartItemFields
 * Resolvers не нужны, так как поля уже доступны в cartItem объекте (из процессора)
 * Оставляем пустой экспорт для совместимости, но resolvers не выполняются
 */
export default {
  CartItem: {
    // Поля productLength, productWidth, productHeight уже есть в cartItem
    // благодаря процессору registerCartItemDimensions и автоматическому camelCase преобразованию
    // Resolvers не нужны - поля берутся напрямую из cartItem
  }
};
