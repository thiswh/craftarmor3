import React, { useState, useEffect, useMemo } from 'react';
import DeliveryMapPicker from '../../../pages/checkout/DeliveryMapPicker.js';
// @ts-ignore - EverShop CartContext types may not be available
import { useCartState } from '@components/frontStore/cart/CartContext';

interface DeliveryCalculation {
  cost: number;
  currency: string;
  deliveryTimeMin: number;
  deliveryTimeMax: number;
}

interface DeliveryPointDetail {
  id: number;
  address: string;
  city: string;
  region?: string | null;
  name?: string | null;
  postal_code?: string | null;
}

/**
 * Переопределение стандартного компонента Shipment из EverShop
 * Добавляет поддержку выбора пункта выдачи через карту MapLibre GL
 * 
 * Путь переопределения: themes/craftarmor/src/components/frontStore/checkout/Shipment.tsx
 * EverShop автоматически найдет и использует этот компонент вместо стандартного
 */
export function Shipment() {
  const [selectedPointId, setSelectedPointId] = useState<number | undefined>();
  const [deliveryCost, setDeliveryCost] = useState<number | null>(null);
  const [deliveryCurrency, setDeliveryCurrency] = useState<string>('RUB');
  const [selectedPoint, setSelectedPoint] = useState<DeliveryPointDetail | null>(null);

  // Получаем данные корзины для проверки структуры
  const { data: cart, loading: cartLoading } = useCartState();

  // Вычисляем параметры корзины для передачи в DeliveryMapPicker
  const cartWeight = cart?.totalWeight?.value 
    ? cart.totalWeight.value / 1000 // конвертируем граммы в кг
    : 0.15; // значение по умолчанию, если корзина пуста
  
  // Вычисляем размеры корзины из cart.items
  // Используем максимальные значения для каждого измерения
  // (для нескольких товаров берем наибольшие размеры)
  const cartDimensions = useMemo(() => {
    if (!cart?.items || cart.items.length === 0) {
      // Значения по умолчанию, если корзина пуста
      return {
        length: 18, // см
        width: 20,  // см
        height: 5   // см
      };
    }

    // Находим максимальные значения размеров среди всех товаров в корзине
    let maxLength = 0;
    let maxWidth = 0;
    let maxHeight = 0;

    cart.items.forEach((item: any) => {
      const length = item.productLength || 0;
      const width = item.productWidth || 0;
      const height = item.productHeight || 0;

      if (length > maxLength) maxLength = length;
      if (width > maxWidth) maxWidth = width;
      if (height > maxHeight) maxHeight = height;
    });

    // Если размеры не найдены, используем значения по умолчанию
    return {
      length: maxLength > 0 ? maxLength : 18,
      width: maxWidth > 0 ? maxWidth : 20,
      height: maxHeight > 0 ? maxHeight : 5
    };
  }, [cart?.items]);

  // Логирование для проверки структуры данных корзины
  useEffect(() => {
    if (cart) {
      console.log('=== [Shipment] Cart Data Structure ===');
      console.log('Full cart object:', cart);
      console.log('Cart items:', cart.items);
      console.log('Cart items count:', cart.items?.length || 0);
      
      if (cart.items && cart.items.length > 0) {
        console.log('=== [Shipment] First Item Structure ===');
        const firstItem = cart.items[0];
        console.log('First item:', firstItem);
        console.log('First item keys:', Object.keys(firstItem));
        
        // Проверяем наличие веса (из логов видно, что это productWeight объект)
        console.log('First item productWeight:', firstItem.productWeight);
        console.log('First item productWeight.value:', firstItem.productWeight?.value);
        console.log('First item productWeight.unit:', firstItem.productWeight?.unit);
        console.log('First item qty:', firstItem.qty);
        
        // Проверяем общий вес в корзине (уже вычислен)
        console.log('Cart totalWeight:', cart.totalWeight);
        console.log('Cart totalWeight.value:', cart.totalWeight?.value);
        console.log('Cart totalWeight.unit:', cart.totalWeight?.unit);
        
        // Проверяем структуру product (не доступен в cart.items)
        console.log('Product object not available in cart item (need to fetch separately)');
        console.log('Product ID available:', firstItem.productId);
        
        // Вычисляем общий вес для проверки (из productWeight.value)
        const calculatedWeight = cart.items.reduce((sum: number, item: any) => {
          const weightValue = item.productWeight?.value || 0;
          const weightUnit = item.productWeight?.unit || 'kg';
          const qty = item.qty || 1;
          // Конвертируем в кг если нужно (пока предполагаем, что все в кг)
          const weightInKg = weightUnit === 'g' ? weightValue / 1000 : weightValue;
          return sum + weightInKg * qty;
        }, 0);
        console.log('=== [Shipment] Calculated Total Weight ===');
        console.log('Calculated weight (kg):', calculatedWeight);
        console.log('Cart totalWeight.value (kg):', cart.totalWeight?.value ? cart.totalWeight.value / 1000 : 'N/A');
        
        // Проверяем размеры (теперь доступны через GraphQL расширение CartItem)
        console.log('=== [Shipment] Dimensions Check ===');
        console.log('First item productLength:', firstItem.productLength);
        console.log('First item productWidth:', firstItem.productWidth);
        console.log('First item productHeight:', firstItem.productHeight);
        console.log('Calculated cart dimensions:', cartDimensions);
      } else {
        console.log('Cart is empty or items not available');
      }
    } else if (cartLoading) {
      console.log('Cart is loading...');
    } else {
      console.log('Cart data is not available');
    }
  }, [cart, cartLoading]);

  // Обработка выбора точки на карте
  const handlePointSelect = (pointId: number, calculation: DeliveryCalculation, pointDetail: DeliveryPointDetail) => {
    setSelectedPointId(pointId);
    setDeliveryCost(calculation.cost);
    setDeliveryCurrency(calculation.currency);
    setSelectedPoint(pointDetail);

    // TODO: Сохранение в CheckoutContext
    // const { updateCheckoutData } = useCheckoutDispatch();
    // updateCheckoutData({
    //   shipping_method: 'cdek_pickup',
    //   delivery_point_id: pointId,
    //   delivery_cost: calculation.cost,
    //   delivery_time_min: calculation.deliveryTimeMin,
    //   delivery_time_max: calculation.deliveryTimeMax,
    // });
  };

  return (
    <div className="shipment-custom">
      <h2 className="text-2xl font-semibold mb-4">Способ доставки</h2>
      
      <div className="mb-4">
        <p className="text-gray-600 mb-4">
          Выберите пункт выдачи на карте
        </p>
        
        <DeliveryMapPicker
          onPointSelect={handlePointSelect}
          selectedPointId={selectedPointId}
          cartWeight={cartWeight}
          cartLength={cartDimensions.length}
          cartWidth={cartDimensions.width}
          cartHeight={cartDimensions.height}
        />
      </div>

      {/* Блок выбранного пункта скрыт - информация отображается в popup на карте */}
    </div>
  );
}
