import React, { useEffect, useMemo, useRef } from 'react';
// @ts-ignore - react-map-gl type issue with React 19
import MapComponent from 'react-map-gl/maplibre';
import { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapRef, ViewState } from 'react-map-gl/maplibre';

export type CourierMapMarker = {
  lat: number;
  lng: number;
};

type CourierMapPickerProps = {
  marker?: CourierMapMarker | null;
  onSelect: (lat: number, lng: number) => void;
  height?: number | string;
};

const DEFAULT_VIEW: ViewState = {
  longitude: 37.6173,
  latitude: 55.7558,
  zoom: 11,
  bearing: 0,
  pitch: 0,
  padding: { top: 0, bottom: 0, left: 0, right: 0 }
};

const isSamePosition = (
  left?: CourierMapMarker | null,
  right?: CourierMapMarker | null
) => {
  if (!left || !right) {
    return false;
  }
  const latDiff = Math.abs(left.lat - right.lat);
  const lngDiff = Math.abs(left.lng - right.lng);
  return latDiff < 0.0001 && lngDiff < 0.0001;
};

export default function CourierMapPicker({
  marker,
  onSelect,
  height
}: CourierMapPickerProps) {
  const mapRef = useRef<MapRef>(null);
  const mapHeight = height ?? 420;
  const viewState = useMemo(() => {
    if (!marker) {
      return DEFAULT_VIEW;
    }
    return {
      ...DEFAULT_VIEW,
      latitude: marker.lat,
      longitude: marker.lng,
      zoom: 15
    };
  }, [marker]);

  useEffect(() => {
    if (!mapRef.current || !marker) {
      return;
    }
    const map = mapRef.current.getMap();
    const center = map.getCenter();
    if (isSamePosition(marker, { lat: center.lat, lng: center.lng })) {
      return;
    }
    map.flyTo({
      center: [marker.lng, marker.lat],
      zoom: map.getZoom(),
      duration: 500
    });
  }, [marker]);

  return (
    <div className="relative w-full h-full" style={{ height: mapHeight }}>
      {/* @ts-ignore - react-map-gl type issue with React 19 */}
      <MapComponent
        ref={mapRef}
        initialViewState={viewState}
        onLoad={() => {
          if (!mapRef.current) {
            return;
          }
          const map: any = mapRef.current.getMap();
          if (map?.scrollZoom?.enable) {
            map.scrollZoom.enable({ around: 'center' });
          }
          if (map?.touchZoomRotate?.enable) {
            map.touchZoomRotate.enable({ around: 'center' });
          }
        }}
        onClick={(event: any) => {
          if (!event?.lngLat || !mapRef.current) {
            return;
          }
          const map = mapRef.current.getMap();
          map.flyTo({
            center: [event.lngLat.lng, event.lngLat.lat],
            zoom: map.getZoom(),
            duration: 350
          });
          onSelect(event.lngLat.lat, event.lngLat.lng);
        }}
        onDragEnd={(event: any) => {
          if (!event?.viewState) {
            return;
          }
          const next = { lat: event.viewState.latitude, lng: event.viewState.longitude };
          if (isSamePosition(marker || null, next)) {
            return;
          }
          onSelect(next.lat, next.lng);
        }}
        style={{ width: '100%', height: '100%' }}
        scrollZoom={{ around: 'center' } as any}
        touchZoomRotate={{ around: 'center' } as any}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        attributionControl={true}
      >
      </MapComponent>
      <div
        className="pointer-events-none absolute left-1/2 top-1/2"
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        <div className="h-4 w-4 rounded-full bg-gray-900 shadow-md ring-2 ring-white" />
      </div>
    </div>
  );
}
