import React, { useState } from 'react';
import DeliveryMapPicker from '../../../pages/checkout/DeliveryMapPicker.js';

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
        />
      </div>

      {/* Блок выбранного пункта скрыт - информация отображается в popup на карте */}
    </div>
  );
}
