import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
// @ts-ignore - react-map-gl type issue with React 19
import MapComponent from 'react-map-gl/maplibre';
import { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapRef, ViewState } from 'react-map-gl/maplibre';
import Supercluster from 'supercluster';
import { _ } from '@evershop/evershop/lib/locale/translate/_';

interface DeliveryPoint {
  id: number;
  latitude: number;
  longitude: number;
  service_code: string;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
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

const formatPickupPointLines = (point: DeliveryPointDetail) => {
  const primary = point.name || point.address || '';
  const city = point.city || '';
  const region = point.region || '';
  const postcode = point.postal_code || '';

  const locationParts: string[] = [];
  if (region && region !== city) {
    locationParts.push(region);
  }
  if (city) {
    locationParts.push(city);
  }
  const locationLine = locationParts.join(', ');

  const detailParts = [locationLine, primary === point.address ? '' : point.address]
    .filter(Boolean)
    .join(', ');
  const detailLine = postcode ? `${detailParts} · ${postcode}` : detailParts;

  const lines: string[] = [];
  if (primary) {
    lines.push(primary);
  }
  if (detailLine) {
    lines.push(detailLine);
  }
  return lines;
};

interface DeliveryMapPickerProps {
  onPointSelect?: (
    pointId: number,
    calculation: DeliveryCalculation,
    pointDetail: DeliveryPointDetail
  ) => void;
  selectedPointId?: number;
  cartWeight?: number;
  cartLength?: number;
  cartWidth?: number;
  cartHeight?: number;
  height?: number | string;
}

const MIN_MAP_ZOOM = 9;
const MAX_MAP_ZOOM = 16;
const DEFAULT_ZOOM = 10;

const CdekMarker = React.memo(
  ({
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
        background: isSelected ? '#111827' : '#fff',
        border: `2px solid ${isSelected ? '#111827' : '#9ca3af'}`,
        borderRadius: '4px',
        padding: '4px 6px',
        fontSize: '10px',
        fontWeight: 'bold',
        color: isSelected ? '#fff' : '#111827',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        transform: isSelected ? 'scale(1.05)' : 'scale(1)',
        transition: 'all 0.2s'
      }}
    >
      CDEK
    </div>
  )
);

const ClusterMarker = React.memo(
  ({
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
        background: '#111827',
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
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        userSelect: 'none'
      }}
    >
      {pointCount}
    </div>
  )
);

export default function DeliveryMapPicker({
  onPointSelect,
  selectedPointId,
  cartWeight = 0.15,
  cartLength = 18,
  cartWidth = 20,
  cartHeight = 5,
  height
}: DeliveryMapPickerProps) {
  const [isClient, setIsClient] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [pointsCache, setPointsCache] = useState<Map<number, DeliveryPoint>>(
    new Map()
  );
  const pointsCacheRef = useRef<Map<number, DeliveryPoint>>(new Map());
  const [currentBounds, setCurrentBounds] = useState<{
    minLat: number;
    minLng: number;
    maxLat: number;
    maxLng: number;
  } | null>(null);
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
  const [clusters, setClusters] = useState<any[]>([]);
  const [pointDetails, setPointDetails] = useState<
    Map<
      number,
      { point: DeliveryPointDetail; calculation: DeliveryCalculation; calcKey: string }
    >
  >(new Map());
  const [openedPointId, setOpenedPointId] = useState<number | null>(null);
  const [activePointId, setActivePointId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isMapActive, setIsMapActive] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const mapRef = useRef<MapRef>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);
  const latestDetailPointRef = useRef<number | null>(null);
  const dimensionsKey = useMemo(
    () => `${cartWeight}-${cartLength}-${cartWidth}-${cartHeight}`,
    [cartWeight, cartLength, cartWidth, cartHeight]
  );

  const mapHeight = height ?? 520;

  const initialViewState: ViewState = {
    longitude: 37.6173,
    latitude: 55.7558,
    zoom: DEFAULT_ZOOM,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 }
  };

  const superclusterRef = useRef(
    new Supercluster({
      radius: 50,
      maxZoom: MAX_MAP_ZOOM,
      minZoom: 0,
      minPoints: 2
    })
  );

  useEffect(() => {
    setIsClient(true);

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 480);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

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

  useEffect(() => {
    if (isListOpen && !isMapActive) {
      setIsMapActive(true);
    }
  }, [isListOpen, isMapActive]);

  const loadPoints = useCallback(async () => {
    if (!mapRef.current) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const bounds = mapRef.current.getBounds();
    const minLat = bounds.getSouth();
    const minLng = bounds.getWest();
    const maxLat = bounds.getNorth();
    const maxLng = bounds.getEast();
    const boundsParam = `${minLat},${minLng},${maxLat},${maxLng}`;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      if (!isMountedRef.current) return;
      setLoading(true);
      setError(null);

      const cachedPointIds = Array.from(pointsCacheRef.current.keys());

      const response = await fetch('/api/delivery/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          bounds: boundsParam,
          services: 'cdek',
          excludeIds: cachedPointIds.length > 0 ? cachedPointIds : undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to load delivery points');
      }

      const data = await response.json();

      if (!isMountedRef.current) return;
      if (data.success && data.data && Array.isArray(data.data.points)) {
        const newPoints = data.data.points as DeliveryPoint[];

        setPointsCache((prev) => {
          const updated = new Map(prev);
          newPoints.forEach((point) => {
            updated.set(point.id, point);
          });
          pointsCacheRef.current = updated;
          return updated;
        });

        setCurrentBounds({ minLat, minLng, maxLat, maxLng });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }

      if (!isMountedRef.current) return;
      console.error('[DeliveryMapPicker] Error loading points:', err);
      setError(err.message || 'Failed to load pickup points.');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, []);

  const handleMoveEnd = useCallback(() => {
    if (!mapRef.current || !isMapActive) return;

    const bounds = mapRef.current.getBounds();
    setCurrentBounds({
      minLat: bounds.getSouth(),
      minLng: bounds.getWest(),
      maxLat: bounds.getNorth(),
      maxLng: bounds.getEast()
    });

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      loadPoints();
    }, 500);
  }, [loadPoints, isMapActive]);

  const loadPointDetailAndCalculate = useCallback(
    async (pointId: number) => {
      let abortController: AbortController | null = null;
      try {
        if (!isMountedRef.current) return;

        if (detailAbortRef.current) {
          detailAbortRef.current.abort();
        }
        abortController = new AbortController();
        detailAbortRef.current = abortController;
        latestDetailPointRef.current = pointId;

        setLoadingDetail(true);
        setError(null);
        setDetailError(null);

        const pointResponse = await fetch(`/api/delivery/points/${pointId}`, {
          signal: abortController.signal
        });

        if (!pointResponse.ok) {
          throw new Error('Failed to load point details');
        }

        const pointData = await pointResponse.json();

        if (!isMountedRef.current || latestDetailPointRef.current !== pointId) {
          return;
        }
        if (!pointData.success || !pointData.data || !pointData.data.point) {
          throw new Error('Point not found');
        }

        const pointDetail: DeliveryPointDetail = pointData.data.point;

        const calcResponse = await fetch('/api/delivery/calculate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          signal: abortController.signal,
          body: JSON.stringify({
            pointId: pointId,
            serviceCode: pointDetail.service_code,
            pointData: {
              postal_code: pointDetail.postal_code,
              city: pointDetail.city,
              address: pointDetail.address,
              region: pointDetail.region,
              service_code: pointDetail.service_code
            },
            weight: cartWeight,
            length: cartLength,
            width: cartWidth,
            height: cartHeight
          })
        });

        if (!calcResponse.ok) {
          throw new Error('Failed to calculate delivery cost');
        }

        const calcData = await calcResponse.json();

        if (!isMountedRef.current || latestDetailPointRef.current !== pointId) {
          return;
        }

        if (!calcData.success || !calcData.data || !calcData.data.calculation) {
          throw new Error(calcData.message || 'Calculation failed');
        }

        const calculation: DeliveryCalculation = {
          cost: calcData.data.calculation.cost,
          currency: calcData.data.calculation.currency || 'RUB',
          deliveryTimeMin: calcData.data.calculation.deliveryTimeMin || 0,
          deliveryTimeMax: calcData.data.calculation.deliveryTimeMax || 0
        };

        setPointDetails(
          (prev) =>
            new Map(prev).set(pointId, {
              point: pointDetail,
              calculation,
              calcKey: dimensionsKey
            })
        );
        setOpenedPointId(pointId);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return;
        }
        if (latestDetailPointRef.current !== pointId) {
          return;
        }
        if (!isMountedRef.current) return;
        setPointDetails((prev) => {
          const updated = new Map(prev);
          updated.delete(pointId);
          return updated;
        });
        console.error('[DeliveryMapPicker] Error loading point detail:', err);
        setError(err.message || 'Failed to load pickup point details.');
        setDetailError(err.message || 'Failed to load pickup point details.');
      } finally {
        if (
          isMountedRef.current &&
          abortController &&
          detailAbortRef.current === abortController
        ) {
          setLoadingDetail(false);
          detailAbortRef.current = null;
        }
      }
    },
    [cartHeight, cartLength, cartWeight, cartWidth, dimensionsKey]
  );

  const handleMarkerClick = useCallback(
    (point: DeliveryPoint) => {
      setActivePointId(point.id);
      setOpenedPointId(point.id);
      setError(null);
      setDetailError(null);
      setPointDetails((prev) => {
        const existingData = prev.get(point.id);
        if (!existingData) {
          loadPointDetailAndCalculate(point.id);
        }
        return prev;
      });
    },
    [loadPointDetailAndCalculate]
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (detailAbortRef.current) {
        detailAbortRef.current.abort();
        detailAbortRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setPointDetails(new Map());
    setOpenedPointId(null);
    setActivePointId(null);
    if (detailAbortRef.current) {
      detailAbortRef.current.abort();
      detailAbortRef.current = null;
    }
    latestDetailPointRef.current = null;
    setLoadingDetail(false);
    setDetailError(null);
  }, [dimensionsKey]);

  useEffect(() => {
    if (selectedPointId) {
      setActivePointId(selectedPointId);
    }
  }, [selectedPointId]);

  useEffect(() => {
    if (isClient && mapRef.current && isMapActive) {
      const timer = setTimeout(() => {
        loadPoints();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isClient, isMapActive, loadPoints]);

  const selectedPointDataRaw = openedPointId
    ? pointDetails.get(openedPointId)
    : null;
  const selectedPointData =
    selectedPointDataRaw && selectedPointDataRaw.calcKey === dimensionsKey
      ? selectedPointDataRaw
      : null;

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
          coordinates: [point.longitude, point.latitude]
        },
        properties: {
          id: point.id,
          point
        }
      });
    });

    return features;
  }, [pointsCache]);

  useEffect(() => {
    if (geoJsonPoints.length === 0 || !currentBounds) {
      setClusters([]);
      return;
    }

    superclusterRef.current.load(geoJsonPoints);

    const bbox: [number, number, number, number] = [
      currentBounds.minLng,
      currentBounds.minLat,
      currentBounds.maxLng,
      currentBounds.maxLat
    ];

    const zoom = Math.floor(currentZoom);
    const newClusters = superclusterRef.current.getClusters(bbox, zoom);
    setClusters(newClusters);
  }, [geoJsonPoints, currentBounds, currentZoom]);

  const markers = useMemo(() => {
    return clusters.map((cluster) => {
      const [longitude, latitude] = cluster.geometry.coordinates;
      const { cluster: isCluster, point_count: pointCount } = cluster.properties;

      if (isCluster) {
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
                if (mapRef.current) {
                  const expansionZoom = Math.min(
                    superclusterRef.current.getClusterExpansionZoom(
                      cluster.id as number
                    ),
                    MAX_MAP_ZOOM
                  );
                  mapRef.current.getMap().flyTo({
                    center: [longitude, latitude],
                    zoom: expansionZoom,
                    duration: 500
                  });
                }
              }}
            />
          </Marker>
        );
      }

      const point = cluster.properties.point as DeliveryPoint;
      return (
        <Marker
          key={`point-${point.id}`}
          longitude={longitude}
          latitude={latitude}
          anchor="bottom"
        >
          <CdekMarker
            isSelected={activePointId === point.id || selectedPointId === point.id}
            onClick={() => handleMarkerClick(point)}
          />
        </Marker>
      );
    });
  }, [clusters, selectedPointId, activePointId, handleMarkerClick]);

  const visiblePoints = useMemo(() => {
    if (!currentBounds) return [];
    const list: DeliveryPoint[] = [];
    pointsCache.forEach((point) => {
      if (
        point.latitude >= currentBounds.minLat &&
        point.latitude <= currentBounds.maxLat &&
        point.longitude >= currentBounds.minLng &&
        point.longitude <= currentBounds.maxLng
      ) {
        list.push(point);
      }
    });
    return list;
  }, [pointsCache, currentBounds]);

  const handlePointListSelect = (point: DeliveryPoint) => {
    setIsMapActive(true);
    setError(null);
    setDetailError(null);
    handleMarkerClick(point);
    if (mapRef.current) {
      mapRef.current.getMap().flyTo({
        center: [point.longitude, point.latitude],
        zoom: Math.max(currentZoom, 14),
        duration: 400
      });
    }
    setIsListOpen(false);
  };

  if (!isClient) {
    return (
      <div className="delivery-map-picker">
        <div
          className="w-full flex items-center justify-center bg-gray-100"
          style={{ height: mapHeight }}
        >
          <div>Loading map...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="delivery-map-picker h-full" style={{ height: mapHeight }}>
      <div className="relative overflow-hidden bg-white h-full min-h-0">
        <div
          className={`grid h-full min-h-0 ${isMobile ? 'grid-cols-1' : 'grid-cols-[360px_1fr]'}`}
        >
          {!isMobile && (
            <aside className="border-r bg-white h-full min-h-0">
              <div className="p-4 border-b">
                <div className="text-sm font-medium">Pickup points</div>
                <div className="text-xs text-gray-500 mt-1">
                  {visiblePoints.length} points in this area
                </div>
              </div>
              <div className="overflow-y-auto h-full min-h-0">
                {visiblePoints.length === 0 && (
                  <div className="p-4 text-sm text-gray-500">
                    No pickup points in this area.
                  </div>
                )}
                {visiblePoints.map((point) => {
                  const title =
                    point.name || point.address || 'Pickup point';
                  const subtitle = [point.city, point.address]
                    .filter(Boolean)
                    .join(', ');
                  const isSelected =
                    activePointId === point.id || selectedPointId === point.id;
                  return (
                    <button
                      key={point.id}
                      type="button"
                      onClick={() => handlePointListSelect(point)}
                      className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 ${
                        isSelected ? 'bg-gray-100' : ''
                      }`}
                    >
                      <div className="text-sm font-medium">{title}</div>
                      {subtitle && (
                        <div className="text-xs text-gray-500 mt-1">
                          {subtitle}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </aside>
          )}

          <div className="relative min-h-0 overflow-hidden">
            <div className="w-full relative h-full min-h-0 overflow-hidden">
              {/* @ts-ignore - react-map-gl type issue with React 19 */}
              <MapComponent
                ref={mapRef}
                initialViewState={initialViewState}
                onMoveEnd={handleMoveEnd}
                minZoom={MIN_MAP_ZOOM}
                maxZoom={MAX_MAP_ZOOM}
                onMove={(evt) => {
                  setCurrentZoom(evt.viewState.zoom);
                  if (currentBounds) {
                    const bounds = mapRef.current?.getBounds();
                    if (bounds) {
                      setCurrentBounds({
                        minLat: bounds.getSouth(),
                        minLng: bounds.getWest(),
                        maxLat: bounds.getNorth(),
                        maxLng: bounds.getEast()
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

              {!isMapActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <button
                    type="button"
                    onClick={() => setIsMapActive(true)}
                    className="px-6 py-3 bg-white text-gray-900 rounded-lg font-medium shadow"
                  >
                    Show pickup points
                  </button>
                </div>
              )}

              {loading && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded shadow text-xs">
                  Loading pickup points...
                </div>
              )}

              {loadingDetail && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded shadow text-xs">
                  Calculating delivery...
                </div>
              )}

              {error && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-red-50 text-red-600 px-3 py-1 rounded shadow text-xs">
                  {error}
                </div>
              )}
            </div>

            {isMobile && (
              <button
                type="button"
                onClick={() => setIsListOpen(true)}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-2 rounded-full text-sm shadow-lg"
              >
                Show {visiblePoints.length} points
              </button>
            )}

            {isMobile && isListOpen && (
              <div className="absolute inset-0 z-30 bg-white flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                  <div className="text-sm font-medium">Pickup points</div>
                  <button
                    type="button"
                    className="text-gray-500"
                    onClick={() => setIsListOpen(false)}
                  >
                    x
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {visiblePoints.length === 0 && (
                    <div className="p-4 text-sm text-gray-500">
                      No pickup points in this area.
                    </div>
                  )}
                  {visiblePoints.map((point) => {
                    const title = point.name || point.address || 'Pickup point';
                    const subtitle = [point.city, point.address]
                      .filter(Boolean)
                      .join(', ');
                    const isSelected = selectedPointId === point.id;
                    return (
                      <button
                        key={point.id}
                        type="button"
                        onClick={() => handlePointListSelect(point)}
                        className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 ${
                          isSelected ? 'bg-gray-100' : ''
                        }`}
                      >
                        <div className="text-sm font-medium">{title}</div>
                        {subtitle && (
                          <div className="text-xs text-gray-500 mt-1">
                            {subtitle}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {openedPointId && (
          <div className="absolute top-0 left-0 h-full w-full max-w-[360px] bg-white border-r shadow-lg z-20 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="text-xs font-medium text-gray-600">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 ${
                    loadingDetail || !selectedPointData
                      ? 'bg-gray-200 text-transparent animate-pulse'
                      : ''
                  }`}
                >
                  {loadingDetail || !selectedPointData
                    ? 'CDEK · PVZ'
                    : selectedPointData.point.service_code
                      ? selectedPointData.point.service_code.toUpperCase()
                      : 'CDEK'}
                  {!loadingDetail &&
                  selectedPointData?.point.metadata?.type
                    ? ` · ${selectedPointData.point.metadata.type}`
                    : ''}
                </span>
              </div>
              <button
                type="button"
                className="text-gray-500"
                onClick={() => setOpenedPointId(null)}
              >
                x
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              {detailError && !loadingDetail ? (
                <div className="text-sm text-red-600">{detailError}</div>
              ) : loadingDetail || !selectedPointData ? (
                <>
                  <div className="space-y-2">
                    <div className="h-4 w-4/5 rounded bg-gray-200 animate-pulse"></div>
                    <div className="h-3 w-full rounded bg-gray-200 animate-pulse"></div>
                  </div>
                  <div className="border-t pt-3 space-y-2">
                    <div className="h-3 w-24 rounded bg-gray-200 animate-pulse"></div>
                    <div className="h-8 w-full rounded bg-gray-200 animate-pulse"></div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="h-16 w-full rounded bg-gray-200 animate-pulse"></div>
                  </div>
                  <div className="h-9 w-full rounded bg-gray-200 animate-pulse"></div>
                </>
              ) : (
                <>
                  <div className="space-y-1 text-xs text-gray-600">
                    {formatPickupPointLines(selectedPointData.point).map(
                      (line, index) => (
                        <div
                          key={line}
                          className={
                            index === 0
                              ? 'text-sm font-medium text-gray-900'
                              : undefined
                          }
                        >
                          {line}
                        </div>
                      )
                    )}
                  </div>

                  {selectedPointData.point.schedule && (
                    <div className="border-t pt-3 space-y-2">
                      <div className="text-xs font-medium text-gray-700">
                        {_('Work schedule')}
                      </div>
                      <div className="rounded-md border bg-gray-50 px-3 py-2 text-xs text-gray-600 whitespace-pre-line">
                        {typeof selectedPointData.point.schedule === 'string'
                          ? selectedPointData.point.schedule
                          : JSON.stringify(selectedPointData.point.schedule)}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-3">
                    <div className="bg-gray-50 border rounded-md p-3 text-center">
                      <div className="text-xs text-gray-500">
                        {_('Delivery cost')}
                      </div>
                      <div className="text-lg font-semibold">
                        {selectedPointData.calculation.cost}{' '}
                        {selectedPointData.calculation.currency}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full bg-gray-900 text-white py-2 rounded-md"
                    onClick={() => {
                      if (onPointSelect && openedPointId) {
                        onPointSelect(
                          openedPointId,
                          selectedPointData.calculation,
                          selectedPointData.point
                        );
                      }
                    }}
                  >
                    {_('Select pickup point')}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
