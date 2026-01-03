import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
// @ts-ignore - react-map-gl type issue with React 19
import MapComponent from 'react-map-gl/maplibre';
import { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapRef, ViewState } from 'react-map-gl/maplibre';
import Supercluster from 'supercluster';

interface DeliveryPoint {
  id: number;
  latitude: number;
  longitude: number;
  service_code: string;
  name?: string | null;
}

interface DeliveryPointDetail {
  id: number;
  external_id: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  region?: string | null;
  postal_code?: string | null;
  name?: string | null;
  schedule?: any;
  metadata?: any;
  service_code: string;
  service_name?: string | null;
}

interface DeliveryCalculation {
  cost: number;
  currency: string;
  deliveryTimeMin: number;
  deliveryTimeMax: number;
}

interface DeliveryMapPickerProps {
  onPointSelect?: (pointId: number, calculation: DeliveryCalculation, pointDetail: DeliveryPointDetail) => void;
  selectedPointId?: number;
}

// Компонент маркера CDEK (мемоизирован для оптимизации)
const CdekMarker = React.memo(({ 
  isSelected, 
  onClick 
}: { 
  isSelected: boolean;
  onClick: () => void;
}) => (
  <div
    onClick={onClick}
    style={{
      cursor: 'pointer',
      background: isSelected ? '#2c2c2c' : '#fff',
      border: `2px solid ${isSelected ? '#1a1a1a' : '#666'}`,
      borderRadius: '4px',
      padding: '4px 6px',
      fontSize: '10px',
      fontWeight: 'bold',
      color: isSelected ? '#fff' : '#333',
      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
      whiteSpace: 'nowrap',
      userSelect: 'none',
      transform: isSelected ? 'scale(1.1)' : 'scale(1)',
      transition: 'all 0.2s',
    }}
  >
    CDEK
  </div>
));

// Компонент кластера
const ClusterMarker = React.memo(({ 
  pointCount, 
  onClick 
}: { 
  pointCount: number;
  onClick: () => void;
}) => (
  <div
    onClick={onClick}
    style={{
      cursor: 'pointer',
      background: '#2c2c2c',
      border: '2px solid #fff',
      borderRadius: '50%',
      width: '40px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      fontWeight: 'bold',
      color: '#fff',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      userSelect: 'none',
    }}
  >
    {pointCount}
  </div>
));

export default function DeliveryMapPicker({ onPointSelect, selectedPointId }: DeliveryMapPickerProps) {
  const [isClient, setIsClient] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Используем initialViewState вместо управляемого viewState для оптимизации
  const initialViewState: ViewState = {
    longitude: 37.6173,
    latitude: 55.7558,
    zoom: 10,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
  };
  // Кеш всех загруженных точек (по ID для быстрого доступа)
  const [pointsCache, setPointsCache] = useState<Map<number, DeliveryPoint>>(new Map());
  // Текущие границы карты для фильтрации точек при рендере
  const [currentBounds, setCurrentBounds] = useState<{ minLat: number; minLng: number; maxLat: number; maxLng: number } | null>(null);
  // Текущий zoom для кластеризации
  const [currentZoom, setCurrentZoom] = useState(initialViewState.zoom);
  // Кластеры для отображения на карте
  const [clusters, setClusters] = useState<any[]>([]);
  const [pointDetails, setPointDetails] = useState<Map<number, { point: DeliveryPointDetail; calculation: DeliveryCalculation }>>(new Map());
  const [openedPointId, setOpenedPointId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const mapRef = useRef<MapRef>(null);
  // Supercluster инстанс для кластеризации
  const superclusterRef = useRef(
    new Supercluster({
      radius: 50, // Радиус кластеризации в пикселях
      maxZoom: 16, // Максимальный zoom для кластеризации
      minZoom: 0,
      minPoints: 2, // Минимальное количество точек для кластера
    })
  );

  // Проверка клиентского рендеринга (SSR fix)
  useEffect(() => {
    setIsClient(true);
    
    // Проверяем размер экрана для адаптивности
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 480); // 480px - breakpoint для мобильных (планшеты и большие экраны остаются с боковой панелью)
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Добавляем стили для popup чтобы текст не выходил за границы и увеличиваем кнопку закрытия
    const style = document.createElement('style');
    style.textContent = `
      .maplibregl-popup-content {
        max-width: 300px !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
      }
      .maplibregl-popup-content > div {
        max-width: 100% !important;
        box-sizing: border-box !important;
      }
      .maplibregl-popup-close-button {
        width: 28px !important;
        height: 28px !important;
        font-size: 20px !important;
        line-height: 28px !important;
        padding: 0 !important;
        right: 4px !important;
        top: 4px !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      window.removeEventListener('resize', checkMobile);
      document.head.removeChild(style);
    };
  }, []);

  // Загрузка точек по границам карты (объединение с кешем)
  const loadPoints = useCallback(async () => {
    if (!mapRef.current) return;

    const bounds = mapRef.current.getBounds();
    const minLat = bounds.getSouth();
    const minLng = bounds.getWest();
    const maxLat = bounds.getNorth();
    const maxLng = bounds.getEast();

    const boundsParam = `${minLat},${minLng},${maxLat},${maxLng}`;

    try {
      if (!isMountedRef.current) return;
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/delivery/points?bounds=${boundsParam}&services=cdek`);
      
      if (!response.ok) {
        throw new Error('Failed to load delivery points');
      }

      const data = await response.json();
      
      if (!isMountedRef.current) return;
      if (data.success && data.data && Array.isArray(data.data.points)) {
        const newPoints = data.data.points as DeliveryPoint[];
        console.log('[DeliveryMapPicker] Loaded points:', newPoints.length);
        
        // Объединяем новые точки с кешем (добавляем только новые)
        setPointsCache(prev => {
          const updated = new Map(prev);
          newPoints.forEach(point => {
            updated.set(point.id, point);
          });
          console.log('[DeliveryMapPicker] Cache size:', updated.size);
          return updated;
        });
        
        // Обновляем текущие границы для фильтрации
        setCurrentBounds({ minLat, minLng, maxLat, maxLng });
      } else {
        console.warn('[DeliveryMapPicker] Invalid response format:', data);
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error('[DeliveryMapPicker] Error loading points:', err);
      setError(err.message || 'Ошибка загрузки пунктов выдачи');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Debounced загрузка точек при изменении карты
  const handleMoveEnd = useCallback(() => {
    if (!mapRef.current) return;
    
    const bounds = mapRef.current.getBounds();
    
    // Обновляем границы сразу для фильтрации/кластеризации существующих точек
    setCurrentBounds({
      minLat: bounds.getSouth(),
      minLng: bounds.getWest(),
      maxLat: bounds.getNorth(),
      maxLng: bounds.getEast(),
    });

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      loadPoints();
    }, 500); // Debounce 500ms
  }, [loadPoints]);

  // Загрузка детальной информации о точке и расчет стоимости (мемоизирован)
  const loadPointDetailAndCalculate = useCallback(async (pointId: number, point: DeliveryPoint) => {
    // Простая защита от повторных запросов - если уже идет загрузка, не делаем новый запрос
    if (loadingDetail) {
      return;
    }

    try {
      if (!isMountedRef.current) return;
      
      setLoadingDetail(true);
      setError(null);

      // Загружаем детальную информацию о точке
      const pointResponse = await fetch(`/api/delivery/points/${pointId}`);
      
      if (!pointResponse.ok) {
        throw new Error('Failed to load point details');
      }

      const pointData = await pointResponse.json();
      
      if (!isMountedRef.current) return;
      if (!pointData.success || !pointData.data || !pointData.data.point) {
        throw new Error('Point not found');
      }

      const pointDetail: DeliveryPointDetail = pointData.data.point;

      // Рассчитываем стоимость доставки
      const totalWeight = 0.15; // TODO: Получать вес из CheckoutContext
      const calcResponse = await fetch('/api/delivery/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pointId: pointId,
          serviceCode: pointDetail.service_code,
          weight: totalWeight,
          length: 18,
          width: 20,
          height: 5,
        }),
      });

      if (!calcResponse.ok) {
        throw new Error('Failed to calculate delivery cost');
      }

      const calcData = await calcResponse.json();
      
      if (!isMountedRef.current) return;
      
      // Если получили ошибку, но это временная ошибка (502, 503), пробуем еще раз
      if (!calcData.success && calcResponse.status >= 500 && calcResponse.status < 600) {
        console.warn('[DeliveryMapPicker] Temporary server error, retrying...', calcData.message);
        // Retry один раз после небольшой задержки
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const retryResponse = await fetch('/api/delivery/calculate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pointId: pointId,
            serviceCode: pointDetail.service_code,
            weight: totalWeight,
            length: 18,
            width: 20,
            height: 5,
          }),
        });

        if (!retryResponse.ok) {
          throw new Error('Failed to calculate delivery cost after retry');
        }

        const retryData = await retryResponse.json();
        
        if (!isMountedRef.current) return;
        if (!retryData.success || !retryData.data || !retryData.data.calculation) {
          throw new Error(retryData.message || 'Calculation failed after retry');
        }

        // Используем данные из retry
        const calculation: DeliveryCalculation = {
          cost: retryData.data.calculation.cost,
          currency: retryData.data.calculation.currency || 'RUB',
          deliveryTimeMin: retryData.data.calculation.deliveryTimeMin || 0,
          deliveryTimeMax: retryData.data.calculation.deliveryTimeMax || 0,
        };

        // Сохраняем данные точки
        setPointDetails(prev => new Map(prev).set(pointId, { point: pointDetail, calculation }));

        // Показываем боковую панель
        setOpenedPointId(pointId);

        return; // Выходим, так как уже обработали
      }
      
      if (!calcData.success || !calcData.data || !calcData.data.calculation) {
        throw new Error(calcData.message || 'Calculation failed');
      }

      const calculation: DeliveryCalculation = {
        cost: calcData.data.calculation.cost,
        currency: calcData.data.calculation.currency || 'RUB',
        deliveryTimeMin: calcData.data.calculation.deliveryTimeMin || 0,
        deliveryTimeMax: calcData.data.calculation.deliveryTimeMax || 0,
      };

      // Сохраняем данные точки
      setPointDetails(prev => new Map(prev).set(pointId, { point: pointDetail, calculation }));

      // Показываем боковую панель
      setOpenedPointId(pointId);

    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error('[DeliveryMapPicker] Error loading point detail:', err);
      setError(err.message || 'Ошибка загрузки информации о пункте');
    } finally {
      if (isMountedRef.current) {
        setLoadingDetail(false);
      }
    }
  }, [loadingDetail]);

  // Обработка клика на маркер
  const handleMarkerClick = useCallback((point: DeliveryPoint) => {
    // Проверяем, есть ли уже данные для этой точки
    setPointDetails(prev => {
      const existingData = prev.get(point.id);
      if (existingData) {
        // Данные уже есть - показываем боковую панель сразу
        // Используем setTimeout чтобы избежать обновления состояния во время рендеринга
        setTimeout(() => {
          setOpenedPointId(point.id);
        }, 0);
      } else {
        // Данных нет - загружаем данные
        // Простая защита от повторных кликов - если уже идет загрузка, игнорируем
        if (!loadingDetail) {
          loadPointDetailAndCalculate(point.id, point);
        }
      }
      return prev; // Не изменяем состояние, только читаем
    });
  }, [loadPointDetailAndCalculate, loadingDetail]);

  // Очистка при размонтировании компонента
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Загрузка точек при монтировании компонента
  useEffect(() => {
    if (isClient && mapRef.current) {
      // Небольшая задержка для инициализации карты
      const timer = setTimeout(() => {
        loadPoints();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isClient, loadPoints]);

  // ВСЕ ХУКИ должны быть ДО любого условного возврата!
  const selectedPointData = openedPointId ? pointDetails.get(openedPointId) : null;

  // Преобразуем точки из кеша в GeoJSON формат для supercluster
  const geoJsonPoints = useMemo(() => {
    const features: Array<{
      type: 'Feature';
      geometry: { type: 'Point'; coordinates: [number, number] };
      properties: { id: number; point: DeliveryPoint };
    }> = [];
    
    pointsCache.forEach((point) => {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [point.longitude, point.latitude],
        },
        properties: {
          id: point.id,
          point,
        },
      });
    });
    
    return features;
  }, [pointsCache]);

  // Загружаем точки в supercluster и обновляем кластеры при изменении
  useEffect(() => {
    if (geoJsonPoints.length === 0 || !currentBounds) {
      setClusters([]);
      return;
    }
    
    // Загружаем точки в supercluster
    superclusterRef.current.load(geoJsonPoints);
    
    // Получаем кластеры на основе текущих bounds и zoom
    const bbox: [number, number, number, number] = [
      currentBounds.minLng,
      currentBounds.minLat,
      currentBounds.maxLng,
      currentBounds.maxLat,
    ];
    
    const zoom = Math.floor(currentZoom);
    const newClusters = superclusterRef.current.getClusters(bbox, zoom);
    setClusters(newClusters);
  }, [geoJsonPoints, currentBounds, currentZoom]);

  // Мемоизируем маркеры (кластеры и отдельные точки)
  const markers = useMemo(() => {
    return clusters.map((cluster) => {
      const [longitude, latitude] = cluster.geometry.coordinates;
      const { cluster: isCluster, point_count: pointCount } = cluster.properties;

      if (isCluster) {
        // Это кластер
        return (
          <Marker
            key={`cluster-${cluster.id}`}
            longitude={longitude}
            latitude={latitude}
            anchor="center"
          >
            <ClusterMarker
              pointCount={pointCount || 0}
              onClick={() => {
                // При клике на кластер увеличиваем zoom
                if (mapRef.current) {
                  const expansionZoom = Math.min(
                    superclusterRef.current.getClusterExpansionZoom(cluster.id as number),
                    18
                  );
                  mapRef.current.getMap().flyTo({
                    center: [longitude, latitude],
                    zoom: expansionZoom,
                    duration: 500,
                  });
                }
              }}
            />
          </Marker>
        );
      }

      // Это отдельная точка
      const point = cluster.properties.point as DeliveryPoint;
      return (
        <Marker
          key={`point-${point.id}`}
          longitude={longitude}
          latitude={latitude}
          anchor="bottom"
        >
          <CdekMarker
            isSelected={selectedPointId === point.id}
            onClick={() => handleMarkerClick(point)}
          />
        </Marker>
      );
    });
  }, [clusters, selectedPointId, handleMarkerClick]);

  // Не рендерим карту на сервере (SSR fix) - ПОСЛЕ всех хуков!
  if (!isClient) {
    return (
      <div className="delivery-map-picker">
        <div className="map-container" style={{ height: '500px', width: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
          <div>Загрузка карты...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="delivery-map-picker">
      <div className="map-container" style={{ height: '500px', width: '100%', position: 'relative' }}>
        {/* @ts-ignore - react-map-gl type issue with React 19 */}
        <MapComponent
          ref={mapRef}
          initialViewState={initialViewState}
          onMoveEnd={handleMoveEnd}
          onMove={(evt) => {
            // Обновляем zoom при движении для более плавной кластеризации
            setCurrentZoom(evt.viewState.zoom);
            if (currentBounds) {
              // Обновляем границы только если они уже установлены (чтобы не блокировать первый рендер)
              const bounds = mapRef.current?.getBounds();
              if (bounds) {
                setCurrentBounds({
                  minLat: bounds.getSouth(),
                  minLng: bounds.getWest(),
                  maxLat: bounds.getNorth(),
                  maxLng: bounds.getEast(),
                });
              }
            }
          }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
          attributionControl={true}
        >
          {markers}
        </MapComponent>

        {/* Боковая панель с информацией о выбранной точке */}
        {openedPointId && selectedPointData && (
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: isMobile ? '100%' : '350px',
            maxWidth: isMobile ? '100%' : '90%',
            height: '100%',
            background: '#1a1a1a',
            boxShadow: isMobile ? 'none' : '-2px 0 8px rgba(0,0,0,0.3)',
            zIndex: 1000,
            overflowY: 'auto',
            transform: 'translateX(0)',
            transition: 'transform 0.3s ease-in-out',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
              {/* Заголовок с типом и службой, кнопкой закрытия */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '2px solid #333',
                flexShrink: 0
              }}>
                <div style={{
                  fontSize: '14px',
                  color: '#e0e0e0',
                  background: '#2c2c2c',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontWeight: '500'
                }}>
                  {selectedPointData.point.metadata?.type || 'ПВЗ'} • {selectedPointData.point.service_name || 'CDEK'}
                </div>
                <button
                  onClick={() => setOpenedPointId(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#999',
                    padding: '0',
                    width: '30px',
                    height: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#2c2c2c'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  ×
                </button>
              </div>

              {/* Адрес */}
              <div style={{
                marginBottom: '16px',
                paddingBottom: '16px',
                borderBottom: '1px solid #333',
                flexShrink: 0
              }}>
                <div style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  marginBottom: '6px',
                  color: '#fff',
                  lineHeight: '1.4'
                }}>
                  {selectedPointData.point.address}
                </div>
                <div style={{
                  fontSize: '13px',
                  color: '#999',
                  lineHeight: '1.3'
                }}>
                  {selectedPointData.point.city}
                  {selectedPointData.point.region && selectedPointData.point.region !== selectedPointData.point.city && `, ${selectedPointData.point.region}`}
                  {selectedPointData.point.postal_code && ` • ${selectedPointData.point.postal_code}`}
                </div>
              </div>

              {/* График работы */}
              {selectedPointData.point.schedule && (
                <div style={{
                  marginBottom: '16px',
                  paddingBottom: '16px',
                  borderBottom: '1px solid #333',
                  flexShrink: 0
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    marginBottom: '6px',
                    color: '#e0e0e0'
                  }}>
                    График работы:
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#ccc',
                    padding: '8px',
                    background: '#2c2c2c',
                    borderRadius: '6px',
                    lineHeight: '1.4'
                  }}>
                    {typeof selectedPointData.point.schedule === 'string' 
                      ? selectedPointData.point.schedule 
                      : JSON.stringify(selectedPointData.point.schedule)}
                  </div>
                </div>
              )}

              {/* Стоимость и кнопка - фиксированные внизу */}
              <div style={{ flexShrink: 0, marginTop: 'auto' }}>
                {/* Стоимость */}
                <div style={{
                  padding: '16px',
                  background: '#2c2c2c',
                  borderRadius: '8px',
                  textAlign: 'center',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#999',
                    marginBottom: '6px'
                  }}>
                    Стоимость доставки
                  </div>
                  <div style={{
                    fontSize: '22px',
                    fontWeight: 'bold',
                    color: '#fff'
                  }}>
                    {selectedPointData.calculation.cost} {selectedPointData.calculation.currency}
                  </div>
                </div>

                {/* Кнопка выбора */}
                <button
                  onClick={() => {
                    if (onPointSelect && openedPointId) {
                      onPointSelect(openedPointId, selectedPointData.calculation, selectedPointData.point);
                      setOpenedPointId(null); // Закрываем панель после выбора
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#fff',
                    color: '#1a1a1a',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background 0.2s, transform 0.1s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e0e0e0';
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  Выбрать пункт выдачи
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'white',
            padding: '8px 16px',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            zIndex: 1000,
          }}>
            Загрузка пунктов...
          </div>
        )}

        {loadingDetail && (
          <div style={{
            position: 'absolute',
            top: '50px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'white',
            padding: '6px 12px',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            zIndex: 1000,
            fontSize: '12px',
          }}>
            Расчет стоимости...
          </div>
        )}

        {error && (
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#fee',
            color: '#c00',
            padding: '8px 16px',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            zIndex: 1000,
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
