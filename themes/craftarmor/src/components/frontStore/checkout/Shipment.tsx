import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DeliveryMapPicker from '../../../pages/checkout/DeliveryMapPicker.js';
import CourierMapPicker, {
  type CourierMapMarker
} from '../../../pages/checkout/CourierMapPicker.js';
import {
  useCartDispatch,
  useCartState
} from '@components/frontStore/cart/CartContext.js';
import {
  useCheckout,
  useCheckoutDispatch
} from '@components/frontStore/checkout/CheckoutContext.js';
import { AddressFormLoadingSkeleton } from '@components/frontStore/customer/address/addressForm/AddressFormLoadingSkeleton.js';
import { NameAndTelephone } from '@components/frontStore/customer/address/addressForm/NameAndTelephone.js';
import { ProvinceAndPostcode } from '@components/frontStore/customer/address/addressForm/ProvinceAndPostcode.js';
import { InputField } from '@components/common/form/InputField.js';
import { SelectField } from '@components/common/form/SelectField.js';
import {
  useCustomer,
  useCustomerDispatch
} from '@components/frontStore/customer/CustomerContext.jsx';
import type { ExtendedCustomerAddress } from '@components/frontStore/customer/CustomerContext.jsx';
import { _ } from '@evershop/evershop/lib/locale/translate/_';
import { useFormContext, useWatch } from 'react-hook-form';
import { toast } from 'react-toastify';
import { useQuery } from 'urql';

interface DeliveryCalculation {
  cost: number;
  currency: string;
  deliveryTimeMin: number;
  deliveryTimeMax: number;
}

interface DeliveryPointDetail {
  id: number;
  external_id?: string | null;
  service_code?: string | null;
  address: string;
  city: string;
  region?: string | null;
  name?: string | null;
  postal_code?: string | null;
}

type DaDataSuggestion = {
  value?: string | null;
  data?: Record<string, any> | null;
};

type DeliveryType = 'pickup' | 'courier';

const PICKUP_METHOD_ID = 'd3d16c61-5acf-4cf7-93d9-258e753cd58b';
const COURIER_METHOD_ID = '1ad1dde4-0b52-4fb9-965f-8c3b5be739e7';

type CustomerRecipient = {
  recipientId?: number;
  uuid?: string;
  fullName?: string | null;
  telephone?: string | null;
  isDefault?: boolean | null;
  updateApi?: string;
  deleteApi?: string;
};

type InvalidCartItem = {
  cart_item_id: number;
  uuid?: string;
  product_id?: number;
  product_name?: string | null;
  product_sku?: string | null;
  reason?: string;
};

const CountriesQuery = `
  query Country {
    allowedCountries  {
      value: code
      label: name
      provinces {
        label: name
        value: code
      }
    }
  }
`;

const AddressOnlyForm = ({
  address = {},
  fieldNamePrefix = 'shippingAddress'
}: {
  address?: Record<string, any>;
  fieldNamePrefix?: string;
}) => {
  const [result] = useQuery({
    query: CountriesQuery
  });
  const { data, fetching, error } = result;
  const { watch, setValue } = useFormContext();

  if (fetching) return <AddressFormLoadingSkeleton />;
  if (error) {
    return <p className="text-critical">{error.message}</p>;
  }

  const getFieldName = (fieldName: string) =>
    fieldNamePrefix ? `${fieldNamePrefix}.${fieldName}` : fieldName;

  const selectedCountry = watch(
    getFieldName('country'),
    address?.country?.code ?? address?.country ?? ''
  );

  return (
    <div className="space-y-4">
      <InputField
        name={getFieldName('address_1')}
        label={_('Address')}
        placeholder={_('Address')}
        defaultValue={address?.address1 || ''}
        required
        validation={{
          required: _('Address is required')
        }}
      />
      <InputField
        name={getFieldName('address_2')}
        label={_('Address 2')}
        placeholder={_('Address 2')}
        defaultValue={address?.address2 || ''}
      />
      <InputField
        name={getFieldName('city')}
        label={_('City')}
        placeholder={_('City')}
        defaultValue={address?.city || ''}
      />
      <SelectField
        defaultValue={address?.country?.code ?? address?.country ?? ''}
        label={_('Country')}
        name={getFieldName('country')}
        placeholder={_('Country')}
        onChange={(value) => {
          setValue(getFieldName('country'), value.target.value);
          setValue(getFieldName('province'), '');
        }}
        required
        validation={{ required: _('Country is required') }}
        options={data?.allowedCountries || []}
      />
      <ProvinceAndPostcode
        country={selectedCountry}
        provinces={
          data?.allowedCountries?.find((item) => item.value === selectedCountry)
            ?.provinces || []
        }
        province={{
          value: address?.province?.code ?? address?.province ?? '',
          label: address?.province?.name || ''
        }}
        postcode={address?.postcode || ''}
        getFieldName={getFieldName}
      />
    </div>
  );
};

const DeliveryAddressSummary = ({
  address
}: {
  address: ExtendedCustomerAddress;
}) => {
  const address1 = address.address1 || (address as any).address_1 || '';
  const address2 = address.address2 || (address as any).address_2 || '';
  const addressLine = [address1, address2].filter(Boolean).join(', ');
  const province =
    address.province?.code ||
    address.province?.name ||
    (address as any).province ||
    '';
  const city = address.city || '';
  const postcode = address.postcode || '';
  const locationLine = [city, province, postcode].filter(Boolean).join(', ');

  return (
    <div className="address__summary">
      {addressLine ? <div className="address-one">{addressLine}</div> : null}
      {locationLine ? (
        <div className="city-province-postcode">
          <div>{locationLine}</div>
        </div>
      ) : null}
    </div>
  );
};

const normalizeDeliveryType = (address: ExtendedCustomerAddress): DeliveryType =>
  address.deliveryType === 'pickup' ? 'pickup' : 'courier';

const normalizeId = (value?: string | number | null) =>
  value === undefined || value === null ? '' : String(value);

const getAddressIdValue = (address: ExtendedCustomerAddress) =>
  (address as any).addressId ??
  (address as any).cartAddressId ??
  (address as any).customerAddressId ??
  (address as any).cart_address_id ??
  (address as any).customer_address_id ??
  (address as any).address_id ??
  (address as any).id ??
  null;

const getAddressId = (address: ExtendedCustomerAddress) =>
  normalizeId(getAddressIdValue(address));

const getAddressKey = (address: ExtendedCustomerAddress) =>
  normalizeId(address.uuid || getAddressIdValue(address));

const getRecipientKey = (fullName?: string | null, telephone?: string | null) => {
  const name = (fullName || '').trim();
  const phone = (telephone || '').trim();
  const key = [name, phone].filter(Boolean).join('|');
  return key;
};

const resolveAddressId = (
  address: ExtendedCustomerAddress,
  addresses: ExtendedCustomerAddress[]
) => {
  const direct = getAddressIdValue(address);
  if (direct) {
    return direct;
  }
  if (address.uuid) {
    const matched = addresses.find((item) => item.uuid === address.uuid);
    return matched ? getAddressIdValue(matched) : null;
  }
  return null;
};

const mapCustomerAddressToForm = (address: ExtendedCustomerAddress) => ({
  full_name: address.fullName || '',
  telephone: address.telephone || '',
  address_1: address.address1 || '',
  address_2: address.address2 || '',
  city: address.city || '',
  province: address.province?.code || address.province?.name || '',
  country: address.country?.code || '',
  postcode: address.postcode || '',
  courier_note: (address as any).courierNote || (address as any).courier_note || ''
});

const getPickupMetaFromAddress = (address?: ExtendedCustomerAddress | null) => {
  if (!address) {
    return null;
  }
  const raw = address as any;
  return {
    pickup_point_id: raw.pickupPointId ?? raw.pickup_point_id ?? null,
    pickup_service_code: raw.pickupServiceCode ?? raw.pickup_service_code ?? null,
    pickup_external_id: raw.pickupExternalId ?? raw.pickup_external_id ?? null,
    pickup_data: raw.pickupData ?? raw.pickup_data ?? null
  };
};

const getPickupSummaryLines = (address: ExtendedCustomerAddress) => {
  const pickupMeta = getPickupMetaFromAddress(address);
  const pickupData = pickupMeta?.pickup_data as Record<string, string> | null;
  const address2 =
    pickupData?.name || address.address2 || (address as any).address_2 || '';
  const address1 =
    pickupData?.address || address.address1 || (address as any).address_1 || '';
  const city = pickupData?.city || address.city || '';
  const province =
    pickupData?.region ||
    address.province?.code ||
    address.province?.name ||
    address.province ||
    '';
  const postcode = pickupData?.postal_code || address.postcode || '';

  const locationParts: string[] = [];
  if (province && province !== city) {
    locationParts.push(province);
  }
  if (city) {
    locationParts.push(city);
  }
  const locationLine = locationParts.join(', ');

  const detailParts = [locationLine, address1, postcode].filter(Boolean);
  const detailLine = detailParts.join(', ');

  const lines: string[] = [];
  if (address2) {
    lines.push(address2);
  }
  if (detailLine) {
    lines.push(detailLine);
  }
  if (lines.length === 0 && address1) {
    lines.push(address1);
  }
  return lines;
};

const getCourierSummaryLines = (address: ExtendedCustomerAddress) => {
  const address1 = address.address1 || (address as any).address_1 || '';
  const address2 = address.address2 || (address as any).address_2 || '';
  const courierNote =
    (address as any).courierNote || (address as any).courier_note || '';
  const city = address.city || '';
  const province =
    address.province?.code ||
    address.province?.name ||
    address.province ||
    '';
  const postcode = address.postcode || '';

  const locationParts: string[] = [];
  if (province && province !== city) {
    locationParts.push(province);
  }
  if (city) {
    locationParts.push(city);
  }
  const locationLine = locationParts.join(', ');

  const detailParts = [locationLine, address1, postcode].filter(Boolean);
  const detailLine = detailParts.join(', ');

  const lines: string[] = [];
  if (address1) {
    lines.push(address1);
  }
  if (detailLine) {
    lines.push(detailLine);
  }
  if (address2) {
    lines.push(address2);
  }
  if (courierNote) {
    lines.push(`${_('Courier note')}: ${courierNote}`);
  }
  if (lines.length === 0 && address1) {
    lines.push(address1);
  }
  return lines;
};

const getPickupIdentity = (address?: any) => {
  const meta = getPickupMetaFromAddress(address);
  if (!meta) {
    return null;
  }
  const pickupData = meta.pickup_data as Record<string, string> | null;
  const pointId =
    meta.pickup_point_id ?? (pickupData?.id ? Number(pickupData.id) : null);
  const externalId = meta.pickup_external_id ?? pickupData?.external_id ?? null;
  const service =
    meta.pickup_service_code ?? pickupData?.service_code ?? 'cdek';
  return { pointId, externalId, service };
};

const isPickupAddressMatch = (left?: any, right?: any) => {
  const leftMeta = getPickupIdentity(left);
  const rightMeta = getPickupIdentity(right);
  if (leftMeta && rightMeta) {
    if (leftMeta.pointId && rightMeta.pointId) {
      return leftMeta.pointId === rightMeta.pointId;
    }
    if (
      leftMeta.externalId &&
      rightMeta.externalId &&
      leftMeta.service === rightMeta.service
    ) {
      return leftMeta.externalId === rightMeta.externalId;
    }
  }
  return isCourierAddressMatch(left, right);
};

const normalizeAddressValue = (value?: string | null) =>
  String(value || '').trim().toLowerCase();

const normalizeCompareValue = (value?: string | null) =>
  normalizeAddressValue(value)
    .replace(/[.,;:/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeCityForCompare = (value?: string | null) =>
  normalizeCompareValue(value)
    .replace(/^(\u0433|\u0433\u043e\u0440\u043e\u0434)\s+/i, '')
    .trim();

const normalizeAddress1ForCompare = (value?: string | null) =>
  normalizeCompareValue(value)
    .replace(/\b(\u0434|\u0434\u043e\u043c)\.?\s*/gi, '')
    .replace(/\b(\u0443\u043b|\u0443\u043b\u0438\u0446\u0430)\.?\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildCourierAddressFingerprint = (meta: {
  address1?: string | null;
  city?: string | null;
  province?: string | null;
}) => {
  const locality = normalizeCityForCompare(meta.city || meta.province || '');
  let address = normalizeAddress1ForCompare(meta.address1 || '');
  if (locality) {
    const escapedLocality = escapeRegExp(locality);
    address = address
      .replace(new RegExp(`\\b${escapedLocality}\\b`, 'gi'), ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return normalizeCompareValue(`${locality} ${address}`);
};

const extractHouseToken = (value?: string | null) => {
  const text = normalizeCompareValue(value);
  const match = text.match(/\b\d+[0-9a-z\u0430-\u044f/-]*\b/i);
  return match ? match[0] : '';
};

const extractStreetToken = (value?: string | null) => {
  const houseToken = extractHouseToken(value);
  let normalized = normalizeAddress1ForCompare(value);
  if (houseToken) {
    normalized = normalized
      .replace(new RegExp(`\\b${escapeRegExp(houseToken)}\\b`, 'i'), ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return normalized;
};

const isSameOrEmpty = (left?: string | null, right?: string | null) => {
  const leftNormalized = normalizeCompareValue(left);
  const rightNormalized = normalizeCompareValue(right);
  if (!leftNormalized || !rightNormalized) {
    return true;
  }
  return leftNormalized === rightNormalized;
};

const getCourierIdentity = (address?: any) => ({
  address1: address?.address1 || address?.address_1 || '',
  address2: address?.address2 || address?.address_2 || '',
  city: address?.city || '',
  province:
    address?.province?.code ||
    address?.province?.name ||
    address?.province ||
    '',
  country:
    address?.country?.code ||
    address?.country?.name ||
    address?.country ||
    '',
  postcode: address?.postcode || ''
});

const getCourierCoreIdentity = (address?: any) => ({
  address1: address?.address1 || address?.address_1 || '',
  city: address?.city || '',
  province:
    address?.province?.code ||
    address?.province?.name ||
    address?.province ||
    '',
  country:
    address?.country?.code ||
    address?.country?.name ||
    address?.country ||
    '',
  postcode: address?.postcode || ''
});

const isCourierAddressCoreMatch = (left?: any, right?: any) => {
  const leftMeta = getCourierCoreIdentity(left);
  const rightMeta = getCourierCoreIdentity(right);

  const leftCity = normalizeCityForCompare(leftMeta.city || leftMeta.province);
  const rightCity = normalizeCityForCompare(
    rightMeta.city || rightMeta.province
  );
  const leftStreet = extractStreetToken(leftMeta.address1);
  const rightStreet = extractStreetToken(rightMeta.address1);
  const leftHouse = extractHouseToken(leftMeta.address1);
  const rightHouse = extractHouseToken(rightMeta.address1);

  const leftFingerprint = buildCourierAddressFingerprint({
    address1: `${leftStreet} ${leftHouse}`.trim(),
    city: leftCity,
    province: ''
  });
  const rightFingerprint = buildCourierAddressFingerprint({
    address1: `${rightStreet} ${rightHouse}`.trim(),
    city: rightCity,
    province: ''
  });

  const leftCountry = normalizeCompareValue(leftMeta.country);
  const rightCountry = normalizeCompareValue(rightMeta.country);
  const leftPostcode = normalizeCompareValue(leftMeta.postcode);
  const rightPostcode = normalizeCompareValue(rightMeta.postcode);
  const postcodeMatches =
    !leftPostcode && !rightPostcode
      ? true
      : leftPostcode && rightPostcode
        ? leftPostcode === rightPostcode
        : Boolean(leftHouse && rightHouse && leftHouse === rightHouse);

  return (
    leftCity.length > 0 &&
    rightCity.length > 0 &&
    leftStreet.length > 0 &&
    rightStreet.length > 0 &&
    leftHouse.length > 0 &&
    rightHouse.length > 0 &&
    leftHouse === rightHouse &&
    leftFingerprint.length > 0 &&
    rightFingerprint.length > 0 &&
    leftFingerprint === rightFingerprint &&
    (!leftCountry || !rightCountry || leftCountry === rightCountry) &&
    postcodeMatches &&
    isSameOrEmpty(leftCity, rightCity)
  );
};

const isCourierAddressMatch = (left?: any, right?: any) => {
  const leftMeta = getCourierIdentity(left);
  const rightMeta = getCourierIdentity(right);
  return (
    normalizeAddressValue(leftMeta.address1) ===
      normalizeAddressValue(rightMeta.address1) &&
    normalizeAddressValue(leftMeta.address2) ===
      normalizeAddressValue(rightMeta.address2) &&
    normalizeAddressValue(leftMeta.city) ===
      normalizeAddressValue(rightMeta.city) &&
    normalizeAddressValue(leftMeta.province) ===
      normalizeAddressValue(rightMeta.province) &&
    normalizeAddressValue(leftMeta.country) ===
      normalizeAddressValue(rightMeta.country) &&
    normalizeAddressValue(leftMeta.postcode) ===
      normalizeAddressValue(rightMeta.postcode)
  );
};

const SUGGEST_CACHE_TTL_MS = 5 * 60 * 1000;
const GEO_CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const COURIER_FOCUS_ZOOM = 16;

const buildGeoCacheKey = (lat: number, lng: number, decimals = 5) => {
  const roundedLat = Number(lat.toFixed(decimals));
  const roundedLng = Number(lng.toFixed(decimals));
  return `${roundedLat},${roundedLng}`;
};

const pruneCache = <T,>(cache: Map<string, { ts: number; data: T }>) => {
  while (cache.size > CACHE_MAX_ENTRIES) {
    const firstKey = cache.keys().next().value as string | undefined;
    if (!firstKey) {
      break;
    }
    cache.delete(firstKey);
  }
};

const isSameCourierMapPoint = (
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

const buildCourierAddressLine1 = (
  data: Record<string, any>,
  fallback: string
) => {
  const parts: string[] = [];
  if (data.street_with_type) {
    parts.push(data.street_with_type);
  }
  if (data.house) {
    parts.push(data.house);
  }
  if (data.block) {
    parts.push(data.block);
  }
  if (parts.length > 0) {
    return parts.join(', ');
  }
  return fallback;
};

const buildCourierAddressLine2 = (data: Record<string, any>) => {
  const parts: string[] = [];
  if (data.flat) {
    const flatLabel = data.flat_type ? `${data.flat_type} ${data.flat}` : data.flat;
    parts.push(flatLabel);
  }
  if (data.office) {
    parts.push(`office ${data.office}`);
  }
  if (data.room) {
    parts.push(`room ${data.room}`);
  }
  return parts.join(', ');
};

const buildCourierAccessLine = (
  entrance?: string,
  floor?: string,
  intercom?: string
) => {
  const parts: string[] = [];
  if (entrance) {
    parts.push(`подъезд ${entrance}`);
  }
  if (floor) {
    parts.push(`этаж ${floor}`);
  }
  if (intercom) {
    parts.push(`домофон ${intercom}`);
  }
  return parts.join(' / ');
};

const buildCourierAddress2 = (
  baseLine2?: string,
  flatLabel?: string,
  entrance?: string,
  floor?: string,
  intercom?: string
) => {
  const base = [baseLine2, flatLabel].filter(Boolean).join(', ');
  const accessLine = buildCourierAccessLine(entrance, floor, intercom);
  if (base && accessLine) {
    return `${base} / ${accessLine}`;
  }
  return base || accessLine;
};

const formatCourierFlatLabel = (label: string, value: string) => {
  const normalized = normalizeCompareValue(label);
  if (
    normalized.startsWith('\u043a\u0432') ||
    normalized.startsWith('\u043a\u0432\u0430\u0440')
  ) {
    return `кв ${value}`;
  }
  if (
    normalized.startsWith('\u043e\u0444\u0438\u0441') ||
    normalized === 'office'
  ) {
    return `офис ${value}`;
  }
  if (
    normalized.startsWith('\u043a\u043e\u043c\u043d') ||
    normalized === 'room'
  ) {
    return `комн ${value}`;
  }
  if (normalized.startsWith('apt') || normalized.startsWith('suite')) {
    return `кв ${value}`;
  }
  return `${label} ${value}`.trim();
};

const splitCourierQuery = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) {
    return { baseQuery: '', flatLabel: '' };
  }
  const labeledMatch = trimmed.match(
    /^(.*)\b(кв|квартира|квар\.|apt|suite|офис|office|room|комн(?:ата)?)\.?\s*([0-9A-Za-zА-Яа-я-]+)\s*$/i
  );
  if (labeledMatch) {
    const baseQuery = labeledMatch[1].replace(/[,\s]+$/, '').trim();
    const flatLabel = formatCourierFlatLabel(labeledMatch[2], labeledMatch[3]);
    return { baseQuery, flatLabel };
  }
  const trailingMatch = trimmed.match(/^(.*\b\d+[A-Za-zА-Яа-я-]?)\s+(\d{1,4})\s*$/);
  if (trailingMatch) {
    return {
      baseQuery: trailingMatch[1].trim(),
      flatLabel: `кв ${trailingMatch[2]}`
    };
  }
  return { baseQuery: trimmed, flatLabel: '' };
};

const extractCourierCity = (data: Record<string, any>) =>
  data.city_with_type ||
  data.city ||
  data.settlement_with_type ||
  data.settlement ||
  data.area_with_type ||
  data.area ||
  '';

const extractCourierRegion = (data: Record<string, any>) =>
  data.region_with_type || data.region || '';

const extractCdekErrorCode = (message: string) => {
  if (!message) {
    return '';
  }
  const match = message.match(/"code"\s*:\s*"([^"]+)"/);
  return match ? match[1] : '';
};

const formatCourierCalcError = (message: string) => {
  const code = extractCdekErrorCode(message);
  const normalized = (message || '').toLowerCase();
  if (
    code === 'v2_recipient_location_not_recognized' ||
    normalized.includes('recipient location is not recognized')
  ) {
    return _('Не удалось рассчитать доставку по этому адресу. Уточните город/улицу или выберите другой адрес.');
  }
  return message || _('Failed to calculate delivery cost');
};

const sortAddressesBySelection = (
  addresses: ExtendedCustomerAddress[],
  selectedKey?: string
) => {
  if (!selectedKey) {
    return addresses;
  }
  const sorted = [...addresses];
  sorted.sort((left, right) => {
    const leftKey = getAddressKey(left);
    const rightKey = getAddressKey(right);
    if (leftKey === selectedKey) {
      return -1;
    }
    if (rightKey === selectedKey) {
      return 1;
    }
    if (left.isDefault && !right.isDefault) {
      return -1;
    }
    if (!left.isDefault && right.isDefault) {
      return 1;
    }
    return 0;
  });
  return sorted;
};

const mergeAddressOrder = (
  ordered: ExtendedCustomerAddress[],
  current: ExtendedCustomerAddress[]
) => {
  if (ordered.length === 0) {
    return current;
  }
  const currentByKey = new Map(
    current.map((item) => [getAddressKey(item), item] as const)
  );
  const orderedKeys = ordered
    .map((item) => getAddressKey(item))
    .filter((key) => currentByKey.has(key));
  const orderedKeySet = new Set(orderedKeys);
  const normalizedOrdered = orderedKeys
    .map((key) => currentByKey.get(key))
    .filter(Boolean) as ExtendedCustomerAddress[];
  const appended = current.filter(
    (item) => !orderedKeySet.has(getAddressKey(item))
  );
  return [...normalizedOrdered, ...appended];
};

const findPickupAddressByPoint = (
  addresses: ExtendedCustomerAddress[],
  pointDetail: DeliveryPointDetail
) =>
  addresses.find((address) => {
    const meta = getPickupMetaFromAddress(address);
    if (!meta) {
      return false;
    }
    const pickupData = meta.pickup_data as Record<string, string> | null;
    const metaPointId =
      meta.pickup_point_id ?? (pickupData?.id ? Number(pickupData.id) : null);
    const metaExternalId = meta.pickup_external_id ?? pickupData?.external_id;
    const metaService =
      meta.pickup_service_code ?? pickupData?.service_code ?? 'cdek';
    if (metaPointId && metaPointId === pointDetail.id) {
      return true;
    }
    if (
      metaExternalId &&
      pointDetail.external_id &&
      metaExternalId === pointDetail.external_id &&
      metaService === (pointDetail.service_code || 'cdek')
    ) {
      return true;
    }
    return false;
  });

export function Shipment() {
  const [selectedPointId, setSelectedPointId] = useState<number | undefined>();
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('pickup');
  const [panelType, setPanelType] = useState<DeliveryType>('pickup');
  const [panelStep, setPanelStep] = useState<'list' | 'detail'>('list');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isRecipientPanelOpen, setIsRecipientPanelOpen] = useState(false);
  const [recipientPanelStep, setRecipientPanelStep] = useState<'list' | 'add'>('list');
  const [selectedPickupAddressId, setSelectedPickupAddressId] = useState<string>('');
  const [selectedCourierAddressId, setSelectedCourierAddressId] = useState<string>('');
  const [selectedRecipientKey, setSelectedRecipientKey] = useState<string>('');
  const [isApplyingShipment, setIsApplyingShipment] = useState(false);
  const [invalidItems, setInvalidItems] = useState<InvalidCartItem[]>([]);
  const [invalidItemsLoading, setInvalidItemsLoading] = useState(false);
  const [isRemovingInvalidItems, setIsRemovingInvalidItems] = useState(false);
  const [courierQuery, setCourierQuery] = useState<string>('');
  const [courierSuggestions, setCourierSuggestions] = useState<DaDataSuggestion[]>([]);
  const [courierSuggestLoading, setCourierSuggestLoading] = useState(false);
  const [courierSuggestError, setCourierSuggestError] = useState<string | null>(null);
  const [isCourierSuggestOpen, setIsCourierSuggestOpen] = useState(false);
  const [isCourierSuggestionSelected, setIsCourierSuggestionSelected] =
    useState(false);
  const [selectedCourierSuggestionValue, setSelectedCourierSuggestionValue] =
    useState('');
  const [selectedCourierSuggestionData, setSelectedCourierSuggestionData] =
    useState<Record<string, any> | null>(null);
  const [selectedCourierAddressLine2, setSelectedCourierAddressLine2] =
    useState('');
  const [courierFlatDraft, setCourierFlatDraft] = useState('');
  const [courierEntrance, setCourierEntrance] = useState('');
  const [courierFloor, setCourierFloor] = useState('');
  const [courierIntercom, setCourierIntercom] = useState('');
  const [courierNoteDraft, setCourierNoteDraft] = useState('');
  const [isCourierQueryExpanded, setIsCourierQueryExpanded] = useState(false);
  const [courierGeoLoading, setCourierGeoLoading] = useState(false);
  const [courierCost, setCourierCost] = useState<number | null>(null);
  const [courierCostCurrency, setCourierCostCurrency] = useState<string>('RUB');
  const [courierCostLoading, setCourierCostLoading] = useState(false);
  const [courierCostError, setCourierCostError] = useState<string | null>(null);
  const [courierMarker, setCourierMarker] = useState<CourierMapMarker | null>(
    null
  );
  const [courierMapZoom, setCourierMapZoom] = useState<number | null>(null);
  const [orderedPickupAddresses, setOrderedPickupAddresses] = useState<
    ExtendedCustomerAddress[]
  >([]);
  const [orderedCourierAddresses, setOrderedCourierAddresses] = useState<
    ExtendedCustomerAddress[]
  >([]);
  const defaultRecipientCreatedRef = useRef(false);
  const bodyOverflowRef = useRef<string | null>(null);
  const panelOpenRef = useRef(false);
  const courierDetailOpenRef = useRef(false);
  const autoAppliedShippingRef = useRef(false);
  const courierSuggestTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const courierQueryInputRef = useRef<HTMLTextAreaElement | null>(null);
  const courierSuggestCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const courierAutoLocateRef = useRef(false);
  const courierSuggestAbortRef = useRef<AbortController | null>(null);
  const courierSuggestCacheRef = useRef(
    new Map<string, { ts: number; data: DaDataSuggestion[] }>()
  );
  const courierGeocodeAbortRef = useRef<AbortController | null>(null);
  const courierGeocodeCacheRef = useRef(
    new Map<string, { ts: number; data: DaDataSuggestion[] }>()
  );
  const courierGeocodeKeyRef = useRef<string | null>(null);
  const courierMapSelectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const courierMapLastSelectionRef = useRef<CourierMapMarker | null>(null);
  const resizeCourierQueryInput = useCallback(
    (forceExpand = false) => {
      const input = courierQueryInputRef.current;
      if (!input) {
        return;
      }
      if (forceExpand || isCourierQueryExpanded) {
        input.style.height = 'auto';
        input.style.height = `${input.scrollHeight}px`;
      } else {
        input.style.height = '40px';
      }
    },
    [isCourierQueryExpanded]
  );

  const { data: cart, loadingStates } = useCartState();
  const {
    addShippingAddress,
    addShippingMethod,
    fetchAvailableShippingMethods,
    removeItem,
    syncCartWithServer
  } = useCartDispatch();
  const { form } = useCheckout();
  const { updateCheckoutData } = useCheckoutDispatch();
  const { customer, isLoading: isCustomerLoading } = useCustomer();
  const { addAddress, deleteAddress, updateAddress, setCustomer } =
    useCustomerDispatch();

  useEffect(() => {
    if (!form?.register) {
      return;
    }
    form.register('shippingAddress.address_1');
    form.register('shippingAddress.address_2');
    form.register('shippingAddress.city');
    form.register('shippingAddress.province');
    form.register('shippingAddress.postcode');
    form.register('shippingAddress.country');
    form.register('shippingAddress.courier_note');
  }, [form]);

  const resetCourierDraft = useCallback(() => {
    setCourierQuery('');
    setCourierSuggestions([]);
    setCourierSuggestLoading(false);
    setCourierSuggestError(null);
    setIsCourierSuggestOpen(false);
    setIsCourierSuggestionSelected(false);
    setSelectedCourierSuggestionValue('');
    setSelectedCourierSuggestionData(null);
    setSelectedCourierAddressLine2('');
    setCourierFlatDraft('');
    setCourierEntrance('');
    setCourierFloor('');
    setCourierIntercom('');
    setCourierNoteDraft('');
    setCourierCost(null);
    setCourierCostError(null);
    setCourierCostLoading(false);
    setCourierMarker(null);
    setCourierMapZoom(null);
    setIsCourierQueryExpanded(false);
    courierSuggestAbortRef.current?.abort();
    courierSuggestAbortRef.current = null;
    courierGeocodeAbortRef.current?.abort();
    courierGeocodeAbortRef.current = null;
    if (courierSuggestTimeoutRef.current) {
      clearTimeout(courierSuggestTimeoutRef.current);
      courierSuggestTimeoutRef.current = null;
    }
    if (courierSuggestCloseTimeout.current) {
      clearTimeout(courierSuggestCloseTimeout.current);
      courierSuggestCloseTimeout.current = null;
    }
    if (courierMapSelectTimeoutRef.current) {
      clearTimeout(courierMapSelectTimeoutRef.current);
      courierMapSelectTimeoutRef.current = null;
    }
    courierGeocodeKeyRef.current = null;
    courierMapLastSelectionRef.current = null;
    courierAutoLocateRef.current = false;
    courierSuppressSuggestRef.current = false;
    const resetField = (field: string) => {
      form.setValue(`shippingAddress.${field}`, '', {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false
      });
    };
    resetField('address_1');
    resetField('address_2');
    resetField('city');
    resetField('province');
    resetField('country');
    resetField('postcode');
    resetField('courier_note');
  }, [form]);

  const shippingAddress = cart?.shippingAddress;
  const availableShippingMethods = cart?.availableShippingMethods;
  const fetchingShippingMethods = loadingStates?.fetchingShippingMethods;

  const pickupMethod =
    availableShippingMethods?.find((method) => method.code === PICKUP_METHOD_ID) ||
    {
      code: PICKUP_METHOD_ID,
      name: _('Pickup from delivery point')
    };
  const courierMethod =
    availableShippingMethods?.find((method) => method.code === COURIER_METHOD_ID) ||
    {
      code: COURIER_METHOD_ID,
      name: _('Courier delivery')
    };

  const customerAddresses = customer?.addresses || [];
  const customerRecipients: CustomerRecipient[] =
    ((customer as any)?.recipients as CustomerRecipient[]) || [];
  const customerPhone = ((customer as any)?.phone as string) || '';
  const addRecipientApi = (customer as any)?.addRecipientApi as string | undefined;
  useEffect(() => {
    if (!customer || customerAddresses.length === 0) {
      return;
    }
    const needsNormalization = customerAddresses.some((address) => {
      const directId = (address as any).addressId;
      if (directId !== undefined && directId !== null) {
        return false;
      }
      const fallbackId = getAddressIdValue(address);
      return fallbackId !== undefined && fallbackId !== null;
    });
    if (!needsNormalization) {
      return;
    }
    const normalizedAddresses = customerAddresses.map((address) => {
      const directId = (address as any).addressId;
      if (directId !== undefined && directId !== null) {
        return address;
      }
      const fallbackId = getAddressIdValue(address);
      if (fallbackId === undefined || fallbackId === null) {
        return address;
      }
      return { ...address, addressId: fallbackId };
    });
    setCustomer({ ...customer, addresses: normalizedAddresses });
  }, [customer, customerAddresses, setCustomer]);

  const recipientOptions = useMemo(() => {
    const map = new Map<
      string,
      { key: string; fullName: string; telephone: string }
    >();
    customerRecipients.forEach((recipient) => {
      const fullName = recipient.fullName || '';
      const telephone = recipient.telephone || '';
      const key = getRecipientKey(fullName, telephone);
      if (!key) {
        return;
      }
      if (!map.has(key)) {
        map.set(key, { key, fullName, telephone });
      }
    });
    return Array.from(map.values());
  }, [customerRecipients]);
  const pickupAddresses = useMemo(() => {
    const filtered = customerAddresses.filter(
      (address) => normalizeDeliveryType(address) === 'pickup'
    );
    return filtered;
  }, [customerAddresses, selectedPickupAddressId]);
  const courierAddresses = useMemo(() => {
    const filtered = customerAddresses.filter(
      (address) => normalizeDeliveryType(address) === 'courier'
    );
    return filtered;
  }, [customerAddresses, selectedCourierAddressId]);

  const selectedPickupAddress = useMemo(
    () =>
      pickupAddresses.find(
        (address) => getAddressKey(address) === selectedPickupAddressId
      ),
    [pickupAddresses, selectedPickupAddressId]
  );
  const selectedCourierAddress = useMemo(
    () =>
      courierAddresses.find(
        (address) => getAddressKey(address) === selectedCourierAddressId
      ),
    [courierAddresses, selectedCourierAddressId]
  );
  const appliedCourierAddress = useMemo(() => {
    if (!shippingAddress) {
      return null;
    }
    return courierAddresses.find((address) =>
      isCourierAddressMatch(address, shippingAddress)
    );
  }, [courierAddresses, shippingAddress]);

  const openPanel = (type: DeliveryType) => {
    if (hasInvalidItems) {
      toast.error(_('Remove unavailable items before selecting delivery.'));
      return;
    }
    setPanelType(type);
    setPanelStep('list');
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
  };

  useEffect(() => {
    const wasOpen = panelOpenRef.current;
    const openingNow = !wasOpen && isPanelOpen;
    const closedNow = wasOpen && !isPanelOpen;
    if (closedNow) {
      setOrderedPickupAddresses([]);
      setOrderedCourierAddresses([]);
    }

    if (isPanelOpen && panelStep === 'list') {
      if (openingNow) {
        if (panelType === 'pickup') {
          const appliedPickup =
            shippingAddress &&
            pickupAddresses.find((address) =>
              isPickupAddressMatch(address, shippingAddress)
            );
          setSelectedPickupAddressId(
            appliedPickup ? getAddressKey(appliedPickup) : ''
          );
        } else {
          const appliedCourier =
            shippingAddress &&
            courierAddresses.find((address) =>
              isCourierAddressMatch(address, shippingAddress)
            );
          setSelectedCourierAddressId(
            appliedCourier ? getAddressKey(appliedCourier) : ''
          );
        }
      }
      if (panelType === 'pickup') {
        setOrderedPickupAddresses((prev) => {
          if (prev.length === 0) {
            return sortAddressesBySelection(
              pickupAddresses,
              selectedPickupAddressId
            );
          }
          return mergeAddressOrder(prev, pickupAddresses);
        });
      } else {
        setOrderedCourierAddresses((prev) => {
          if (prev.length === 0) {
            return sortAddressesBySelection(
              courierAddresses,
              selectedCourierAddressId
            );
          }
          return mergeAddressOrder(prev, courierAddresses);
        });
      }
    }

    panelOpenRef.current = isPanelOpen;
  }, [
    isPanelOpen,
    panelStep,
    panelType,
    pickupAddresses,
    courierAddresses,
    shippingAddress,
    selectedPickupAddressId,
    selectedCourierAddressId
  ]);

  useEffect(() => {
    const isCourierDetailOpen =
      isPanelOpen && panelType === 'courier' && panelStep === 'detail';
    if (isCourierDetailOpen && !courierDetailOpenRef.current) {
      resetCourierDraft();
    }
    courierDetailOpenRef.current = isCourierDetailOpen;
  }, [isPanelOpen, panelStep, panelType, resetCourierDraft]);

  const displayPickupAddresses =
    orderedPickupAddresses.length > 0 ? orderedPickupAddresses : pickupAddresses;
  const displayCourierAddresses =
    orderedCourierAddresses.length > 0
      ? orderedCourierAddresses
      : courierAddresses;

  const openRecipientPanel = () => {
    setRecipientPanelStep('list');
    setIsRecipientPanelOpen(true);
  };

  const closeRecipientPanel = () => {
    setIsRecipientPanelOpen(false);
  };

  useEffect(() => {
    const handler = () => {
      openRecipientPanel();
    };
    window.addEventListener('checkout:open-recipient-panel', handler);
    return () => {
      window.removeEventListener('checkout:open-recipient-panel', handler);
    };
  }, []);

  const primeRecipientDraft = (fullName?: string, telephone?: string) => {
    form.setValue('recipient.full_name', fullName || '');
    form.setValue('recipient.telephone', telephone || '');
  };

  const handleDeliveryTypeChange = (type: DeliveryType) => {
    if (isPanelOpen) {
      setPanelType(type);
      setPanelStep('list');
    }
  };

  const applyRecipientSelection = async (
    fullName?: string,
    telephone?: string
  ) => {
    const name = (fullName || '').trim();
    const phone = (telephone || '').trim();
    if (!name || !phone) {
      toast.error(_('Enter full name and telephone for the recipient'));
      return;
    }
    setShippingAddressFields({
      full_name: name,
      telephone: phone
    });
    const key = getRecipientKey(name, phone);
    if (key) {
      setSelectedRecipientKey(key);
    }
    if (customer) {
      try {
        await ensureRecipient(name, phone);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : _('Failed to save recipient')
        );
        return;
      }
    }
    closeRecipientPanel();
  };

  const ensureRecipient = async (
    fullName: string,
    telephone: string,
    options?: { isDefault?: boolean }
  ) => {
    const key = getRecipientKey(fullName, telephone);
    if (!customer || !key) {
      return null;
    }

    const existing = customerRecipients.find(
      (recipient) =>
        getRecipientKey(recipient.fullName || '', recipient.telephone || '') === key
    );
    if (existing) {
      return existing;
    }

    if (!addRecipientApi) {
      return null;
    }

    const payload: Record<string, string | boolean> = {
      full_name: fullName,
      telephone
    };
    if (options?.isDefault) {
      payload.is_default = true;
    }

    const response = await fetch(addRecipientApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(
        json.error?.message || _('Failed to save recipient')
      );
    }
    if (json.error) {
      throw new Error(json.error.message || _('Failed to save recipient'));
    }
    const created = json.data || json;
    if (created) {
      setCustomer({
        ...customer,
        recipients: [...customerRecipients, created]
      } as any);
    }
    return created as CustomerRecipient;
  };

  const cartWeight = cart?.totalWeight?.value
    ? cart.totalWeight.value / 1000
    : 0.15;

  const cartDimensions = useMemo(() => {
    if (cart?.totalLength && cart?.totalWidth && cart?.totalHeight) {
      return {
        length: cart.totalLength,
        width: cart.totalWidth,
        height: cart.totalHeight
      };
    }

    return {
      length: 18,
      width: 20,
      height: 5
    };
  }, [cart?.totalLength, cart?.totalWidth, cart?.totalHeight]);

  useEffect(() => {
    if (!cart?.shippingMethod) {
      return;
    }
    if (cart.shippingMethod === PICKUP_METHOD_ID) {
      setDeliveryType('pickup');
      setPanelType('pickup');
    } else if (cart.shippingMethod === COURIER_METHOD_ID) {
      setDeliveryType('courier');
      setPanelType('courier');
    }
  }, [cart?.shippingMethod]);

  const watchedShippingAddress = useWatch({
    control: form.control,
    name: 'shippingAddress'
  });
  const watchedRecipient = useWatch({
    control: form.control,
    name: 'recipient'
  });
  const courierHasStreetAndHouse = Boolean(
    (selectedCourierSuggestionData?.street_with_type ||
      selectedCourierSuggestionData?.street) &&
      (selectedCourierSuggestionData?.house ||
        selectedCourierSuggestionData?.house_fias_id)
  );
  const courierBaseAddressReady = Boolean(
    watchedShippingAddress?.address_1 &&
      (watchedShippingAddress?.city || watchedShippingAddress?.province) &&
      watchedShippingAddress?.postcode
  );
  const courierAddressReady =
    courierBaseAddressReady &&
    isCourierSuggestionSelected &&
    courierHasStreetAndHouse;

  useEffect(() => {
    const nextNote = (watchedShippingAddress as any)?.courier_note || '';
    if (nextNote !== courierNoteDraft) {
      setCourierNoteDraft(nextNote);
    }
  }, [courierNoteDraft, (watchedShippingAddress as any)?.courier_note]);


  useEffect(() => {
    if (selectedRecipientKey) {
      return;
    }
    if (
      watchedShippingAddress?.full_name ||
      watchedShippingAddress?.telephone
    ) {
      const key = getRecipientKey(
        watchedShippingAddress?.full_name,
        watchedShippingAddress?.telephone
      );
      if (key) {
        setSelectedRecipientKey(key);
      }
      return;
    }
    const fallbackRecipient =
      customer && (customer.fullName || customerPhone)
        ? {
            fullName: customer.fullName,
            telephone: customerPhone,
            isDefault: true
          }
        : null;
    const defaultRecipient =
      customerRecipients.find((recipient) => recipient.isDefault) ||
      customerRecipients[0] ||
      fallbackRecipient;
    const initialFullName =
      watchedShippingAddress?.full_name ||
      shippingAddress?.fullName ||
      defaultRecipient?.fullName ||
      customer?.fullName ||
      '';
    const initialTelephone =
      watchedShippingAddress?.telephone ||
      shippingAddress?.telephone ||
      defaultRecipient?.telephone ||
      customerPhone ||
      '';
    if (!initialFullName && !initialTelephone) {
      return;
    }
    setShippingAddressFields({
      full_name: initialFullName,
      telephone: initialTelephone
    });
    const initialKey = getRecipientKey(initialFullName, initialTelephone);
    if (initialKey) {
      setSelectedRecipientKey(initialKey);
    }
  }, [
    customer,
    customerPhone,
    customerRecipients,
    selectedRecipientKey,
    shippingAddress?.fullName,
    shippingAddress?.telephone,
    watchedShippingAddress?.full_name,
    watchedShippingAddress?.telephone
  ]);

  useEffect(() => {
    if (!customer) {
      return;
    }
    if (defaultRecipientCreatedRef.current) {
      return;
    }
    if (customerRecipients.length > 0) {
      return;
    }
    if (!addRecipientApi) {
      return;
    }
    const name = (customer.fullName || '').trim();
    const phone = (customerPhone || '').trim();
    if (!name || !phone) {
      return;
    }
    defaultRecipientCreatedRef.current = true;
    ensureRecipient(name, phone, { isDefault: true }).catch(() => {
      defaultRecipientCreatedRef.current = false;
    });
  }, [addRecipientApi, customer, customerPhone, customerRecipients.length]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const shouldLock =
      isPanelOpen && panelStep === 'detail' && panelType === 'pickup';
    if (shouldLock) {
      if (bodyOverflowRef.current === null) {
        bodyOverflowRef.current = document.body.style.overflow || '';
      }
      document.body.style.overflow = 'hidden';
    } else if (bodyOverflowRef.current !== null) {
      document.body.style.overflow = bodyOverflowRef.current;
      bodyOverflowRef.current = null;
    }
  }, [isPanelOpen, panelStep, panelType]);

  const dirtyFields = form.formState.dirtyFields;
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const courierSuppressSuggestRef = useRef(false);
  const courierGeocodeRequestRef = useRef(0);
  const lastFetchParamsRef = useRef<{
    country?: string;
    province?: string;
    postcode?: string;
  } | null>(
    shippingAddress
      ? {
          country: shippingAddress.country?.code,
          province: shippingAddress.province?.code,
          postcode: shippingAddress.postcode || undefined
        }
      : null
  );
  const clearingShippingRef = useRef(false);

  useEffect(() => {
    const fetchShippingMethods = async () => {
      try {
        const country = form.getValues('shippingAddress.country');
        const province = form.getValues('shippingAddress.province');
        const postcode = form.getValues('shippingAddress.postcode');

        if (!country) {
          return;
        }

        const currentParams = { country, province, postcode };
        const lastParams = lastFetchParamsRef.current;

        if (
          lastParams &&
          lastParams.country === country &&
          lastParams.province === province &&
          lastParams.postcode === postcode
        ) {
          return;
        }

        lastFetchParamsRef.current = currentParams;

        await fetchAvailableShippingMethods({ country, province, postcode });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : _('Failed to update shipment')
        );
      }
    };

    if (watchedShippingAddress && dirtyFields.shippingAddress) {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        fetchShippingMethods();
      }, 800);
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [watchedShippingAddress, dirtyFields.shippingAddress]);

  useEffect(() => {
    if (!selectedPickupAddressId && pickupAddresses.length > 0) {
      const defaultPickup =
        pickupAddresses.find((address) => address.isDefault) || pickupAddresses[0];
      const defaultId = getAddressKey(defaultPickup);
      if (defaultId) {
        setSelectedPickupAddressId(defaultId);
      }
    }
  }, [pickupAddresses, selectedPickupAddressId]);

  useEffect(() => {
    if (!selectedCourierAddressId && courierAddresses.length > 0) {
      const defaultCourier =
        courierAddresses.find((address) => address.isDefault) || courierAddresses[0];
      const defaultId = getAddressKey(defaultCourier);
      if (defaultId) {
        setSelectedCourierAddressId(defaultId);
      }
    }
  }, [courierAddresses, selectedCourierAddressId]);

  const hasDelivery = Boolean(cart?.shippingMethod && cart?.shippingAddress);
  const summaryAddress = hasDelivery ? shippingAddress : null;
  const pickupSummaryData =
    deliveryType === 'pickup' ? getPickupMetaFromAddress(summaryAddress as any) : null;

  const deliverySummaryLines = useMemo(() => {
    if (!summaryAddress) {
      return [];
    }

    const pickupData =
      deliveryType === 'pickup'
        ? (pickupSummaryData?.pickup_data as Record<string, string> | null)
        : null;

    const address1 =
      pickupData?.address || summaryAddress.address1 || summaryAddress.address_1 || '';
    const address2 =
      pickupData?.name || summaryAddress.address2 || summaryAddress.address_2 || '';
    let courierNote =
      (summaryAddress as any).courierNote ||
      (summaryAddress as any).courier_note ||
      '';
    if (!courierNote && appliedCourierAddress) {
      courierNote =
        (appliedCourierAddress as any)?.courierNote ||
        (appliedCourierAddress as any)?.courier_note ||
        '';
    }
    const city = pickupData?.city || summaryAddress.city || '';
    const province =
      pickupData?.region ||
      summaryAddress.province?.code ||
      summaryAddress.province?.name ||
      summaryAddress.province ||
      '';
    const postcode = pickupData?.postal_code || summaryAddress.postcode || '';

    const locationParts: string[] = [];
    if (province && province !== city) {
      locationParts.push(province);
    }
    if (city) {
      locationParts.push(city);
    }
    const locationLine = locationParts.join(', ');

    const detailParts = [locationLine, address1, postcode].filter(Boolean);
    const detailLine = detailParts.join(', ');

    const lines: string[] = [];
    if (deliveryType === 'pickup') {
      if (address2) {
        lines.push(address2);
      }
      if (detailLine) {
        lines.push(detailLine);
      }
    } else {
      if (address1) {
        lines.push(address1);
      }
      if (detailLine) {
        lines.push(detailLine);
      }
      if (address2) {
        lines.push(address2);
      }
      if (courierNote) {
        lines.push(`${_('Courier note')}: ${courierNote}`);
      }
    }

    return lines.length > 0 ? lines : [];
  }, [deliveryType, pickupSummaryData, summaryAddress, appliedCourierAddress]);

  const updateShipment = async (
    method: { code: string; name: string },
    extraAddressData?: Record<string, unknown>
  ) => {
    if (isApplyingShipment) {
      return false;
    }
    let addressApplied = false;
    try {
      setIsApplyingShipment(true);
      const validate = await form.trigger('shippingAddress');
      if (!validate) {
        return false;
      }
      const updatedShippingAddress = {
        ...form.getValues('shippingAddress'),
        ...(extraAddressData || {})
      };
      if (!updatedShippingAddress.full_name || !updatedShippingAddress.telephone) {
        toast.error(_('Enter full name and telephone for the recipient'));
        return false;
      }

      await addShippingAddress(updatedShippingAddress);
      addressApplied = true;
      await addShippingMethod(method.code, method.name);
      return true;
    } catch (error) {
      if (addressApplied) {
        await clearShippingSelection();
        clearDeliveryAddressFields();
        setSelectedPickupAddressId('');
        setSelectedCourierAddressId('');
        setSelectedPointId(undefined);
      }
      toast.error(
        error instanceof Error ? error.message : _('Failed to update shipment')
      );
      return false;
    } finally {
      setIsApplyingShipment(false);
    }
  };

  const setShippingAddressFields = (
    addressData: Record<string, string>,
    options?: { preserveRecipient?: boolean }
  ) => {
    const payload = { ...addressData };
    if (options?.preserveRecipient) {
      const currentName = form.getValues('shippingAddress.full_name');
      const currentPhone = form.getValues('shippingAddress.telephone');
      if (currentName) {
        delete payload.full_name;
      }
      if (currentPhone) {
        delete payload.telephone;
      }
    }
    Object.entries(payload).forEach(([key, value]) => {
      form.setValue(`shippingAddress.${key}`, value || '');
    });
  };

  const buildCourierAddress2Value = useCallback(
    (overrides?: {
      baseLine2?: string;
      flatLabel?: string;
      entrance?: string;
      floor?: string;
      intercom?: string;
    }) => {
      return buildCourierAddress2(
        overrides?.baseLine2 ?? selectedCourierAddressLine2,
        overrides?.flatLabel ?? courierFlatDraft,
        overrides?.entrance ?? courierEntrance,
        overrides?.floor ?? courierFloor,
        overrides?.intercom ?? courierIntercom
      );
    },
    [
      courierEntrance,
      courierFlatDraft,
      courierFloor,
      courierIntercom,
      selectedCourierAddressLine2
    ]
  );

  const updateCourierAddress2 = useCallback(
    (overrides?: {
      baseLine2?: string;
      flatLabel?: string;
      entrance?: string;
      floor?: string;
      intercom?: string;
    }) => {
      const nextAddress2 = buildCourierAddress2Value(overrides);
      setShippingAddressFields({ address_2: nextAddress2 }, { preserveRecipient: true });
      return nextAddress2;
    },
    [buildCourierAddress2Value, setShippingAddressFields]
  );

  const applyCourierSuggestion = useCallback(
    (suggestion: DaDataSuggestion, options?: { skipMarkerUpdate?: boolean }) => {
      const data = suggestion?.data || {};
      const address1 = buildCourierAddressLine1(data, suggestion?.value || '');
      const address2 = buildCourierAddressLine2(data);
      const city = extractCourierCity(data);
      const province = extractCourierRegion(data);
      const postcode = data.postal_code || '';
      const selectedValue = (suggestion?.value || address1).trim();
      const manualFlat = courierFlatDraft ? courierFlatDraft : '';
      const displayValue = selectedValue
        ? `${selectedValue}${manualFlat ? `, ${manualFlat}` : ''} `
        : '';
      const hasStreet = Boolean(data.street_with_type || data.street);
      const hasHouse = Boolean(data.house || data.house_fias_id);
      if (!hasStreet || !hasHouse) {
        courierSuppressSuggestRef.current = true;
        setCourierQuery(displayValue);
        setIsCourierSuggestionSelected(false);
        setSelectedCourierSuggestionValue('');
        setSelectedCourierSuggestionData(null);
        setSelectedCourierAddressLine2('');
        setCourierEntrance('');
        setCourierFloor('');
        setCourierIntercom('');
        updateCourierAddress2({
          baseLine2: '',
          flatLabel: '',
          entrance: '',
          floor: '',
          intercom: ''
        });
        setCourierSuggestions([]);
        setIsCourierSuggestOpen(false);
        setCourierCost(null);
        setCourierCostError(null);
        setIsCourierQueryExpanded(true);
        setCourierSuggestError(_('Select an address with street and house.'));
        resizeCourierQueryInput(true);
        return;
      }
      setShippingAddressFields(
        {
          address_1: address1,
          city,
          province,
          postcode,
          country: 'RU'
        },
        { preserveRecipient: true }
      );
      courierSuppressSuggestRef.current = true;
      setCourierQuery(displayValue);
      setIsCourierSuggestionSelected(true);
      setSelectedCourierSuggestionValue(selectedValue);
      setSelectedCourierSuggestionData(data);
      setSelectedCourierAddressLine2(address2);
      updateCourierAddress2({ baseLine2: address2, flatLabel: manualFlat });
      setIsCourierQueryExpanded(true);
      setCourierSuggestions([]);
      setCourierSuggestError(null);
      setIsCourierSuggestOpen(false);
      setCourierCost(null);
      setCourierCostError(null);
      resizeCourierQueryInput(true);

      const lat = parseFloat(String(data.geo_lat || ''));
      const lng = parseFloat(String(data.geo_lon || ''));
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        !options?.skipMarkerUpdate
      ) {
        setCourierMarker({ lat, lng });
        setCourierMapZoom(COURIER_FOCUS_ZOOM);
      }
    },
    [
      courierFlatDraft,
      resizeCourierQueryInput,
      setShippingAddressFields,
      updateCourierAddress2
    ]
  );

  const loadCourierSuggestions = useCallback(async (query: string) => {
    try {
      const { baseQuery } = splitCourierQuery(query);
      const normalizedQuery = baseQuery.trim().toLowerCase();
      if (!normalizedQuery) {
        setCourierSuggestions([]);
        setCourierSuggestLoading(false);
        setCourierSuggestError(null);
        return;
      }
      const cacheEntry = courierSuggestCacheRef.current.get(normalizedQuery);
      if (cacheEntry && Date.now() - cacheEntry.ts < SUGGEST_CACHE_TTL_MS) {
        setCourierSuggestions(cacheEntry.data);
        setCourierSuggestLoading(false);
        setCourierSuggestError(null);
        return;
      }

      courierSuggestAbortRef.current?.abort();
      const controller = new AbortController();
      courierSuggestAbortRef.current = controller;

      setCourierSuggestLoading(true);
      setCourierSuggestError(null);

      const response = await fetch('/api/delivery/courier/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: baseQuery }),
        signal: controller.signal
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message || data?.error?.message || 'Failed to load suggestions'
        );
      }
      const suggestions = Array.isArray(data?.data?.suggestions)
        ? data.data.suggestions
        : [];
      courierSuggestCacheRef.current.set(normalizedQuery, {
        ts: Date.now(),
        data: suggestions
      });
      pruneCache(courierSuggestCacheRef.current);
      setCourierSuggestions(suggestions);
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return;
      }
      setCourierSuggestions([]);
      setCourierSuggestError(error?.message || 'Failed to load suggestions');
    } finally {
      setCourierSuggestLoading(false);
    }
  }, []);

  const geolocateCourierAddress = useCallback(
    async (lat: number, lng: number, options?: { preserveMarker?: boolean }) => {
      const requestId = ++courierGeocodeRequestRef.current;
      setCourierGeoLoading(true);
      setCourierSuggestError(null);
      setIsCourierSuggestionSelected(false);
      setSelectedCourierSuggestionValue('');
      setSelectedCourierSuggestionData(null);
      setCourierCost(null);
      setCourierCostError(null);
      try {
        const geoKey = buildGeoCacheKey(lat, lng);
        if (courierGeocodeKeyRef.current === geoKey) {
          setCourierGeoLoading(false);
          return;
        }
        courierGeocodeKeyRef.current = geoKey;
        const cacheEntry = courierGeocodeCacheRef.current.get(geoKey);
        if (cacheEntry && Date.now() - cacheEntry.ts < GEO_CACHE_TTL_MS) {
          if (
            courierGeocodeRequestRef.current !== requestId ||
            courierGeocodeKeyRef.current !== geoKey
          ) {
            setCourierGeoLoading(false);
            return;
          }
          const suggestion = cacheEntry.data[0];
          if (suggestion) {
            const suggestionData = suggestion?.data || {};
            const hasStreet = Boolean(
              suggestionData.street_with_type || suggestionData.street
            );
            const hasHouse = Boolean(
              suggestionData.house || suggestionData.house_fias_id
            );
            if (hasStreet && hasHouse) {
              applyCourierSuggestion(suggestion, {
                skipMarkerUpdate: options?.preserveMarker
              });
            } else {
              const displayValue =
                suggestion?.value || suggestion?.unrestricted_value || '';
              if (displayValue) {
                courierSuppressSuggestRef.current = true;
                setCourierQuery(`${displayValue} `);
                setIsCourierQueryExpanded(true);
                resizeCourierQueryInput(true);
              }
              setCourierSuggestError(_('Select an address with street and house.'));
              setIsCourierSuggestionSelected(false);
            setSelectedCourierSuggestionValue('');
            setSelectedCourierSuggestionData(suggestionData);
            setSelectedCourierAddressLine2('');
            setCourierEntrance('');
            setCourierFloor('');
            setCourierIntercom('');
            updateCourierAddress2({
              baseLine2: '',
              flatLabel: '',
              entrance: '',
              floor: '',
              intercom: ''
            });
            setCourierSuggestions([]);
            setIsCourierSuggestOpen(false);
            }
          }
          setCourierGeoLoading(false);
          return;
        }

        courierGeocodeAbortRef.current?.abort();
        const controller = new AbortController();
        courierGeocodeAbortRef.current = controller;

        const response = await fetch('/api/delivery/courier/geolocate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lon: lng }),
          signal: controller.signal
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
          throw new Error(
            data?.message || data?.error?.message || 'Failed to geolocate'
          );
        }
        if (
          courierGeocodeRequestRef.current !== requestId ||
          courierGeocodeKeyRef.current !== geoKey
        ) {
          setCourierGeoLoading(false);
          return;
        }
        const suggestions = Array.isArray(data?.data?.suggestions)
          ? data.data.suggestions
          : [];
        courierGeocodeCacheRef.current.set(geoKey, {
          ts: Date.now(),
          data: suggestions
        });
        pruneCache(courierGeocodeCacheRef.current);

        const suggestion = suggestions[0];
        if (suggestion) {
          const suggestionData = suggestion?.data || {};
          const hasStreet = Boolean(
            suggestionData.street_with_type || suggestionData.street
          );
          const hasHouse = Boolean(
            suggestionData.house || suggestionData.house_fias_id
          );
          if (hasStreet && hasHouse) {
            applyCourierSuggestion(suggestion, {
              skipMarkerUpdate: options?.preserveMarker
            });
          } else {
            const displayValue =
              suggestion?.value || suggestion?.unrestricted_value || '';
            if (displayValue) {
              courierSuppressSuggestRef.current = true;
              setCourierQuery(`${displayValue} `);
              setIsCourierQueryExpanded(true);
              resizeCourierQueryInput(true);
            }
            setCourierSuggestError(_('Select an address with street and house.'));
            setIsCourierSuggestionSelected(false);
            setSelectedCourierSuggestionValue('');
            setSelectedCourierSuggestionData(suggestionData);
            setSelectedCourierAddressLine2('');
            setCourierEntrance('');
            setCourierFloor('');
            setCourierIntercom('');
            updateCourierAddress2({
              baseLine2: '',
              flatLabel: '',
              entrance: '',
              floor: '',
              intercom: ''
            });
            setCourierSuggestions([]);
            setIsCourierSuggestOpen(false);
          }
        } else {
          setCourierMarker({ lat, lng });
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          return;
        }
        setCourierSuggestError(
          error?.message || 'Failed to update address'
        );
        setCourierMarker({ lat, lng });
      } finally {
        setCourierGeoLoading(false);
      }
    },
    [applyCourierSuggestion, resizeCourierQueryInput, updateCourierAddress2]
  );

  const handleCourierMapSelect = useCallback(
    (lat: number, lng: number) => {
      const next = { lat, lng };
      const samePoint = isSameCourierMapPoint(
        courierMapLastSelectionRef.current,
        next
      );
      const sameGeoKey =
        courierGeocodeKeyRef.current === buildGeoCacheKey(lat, lng);
      if (samePoint && sameGeoKey) {
        return;
      }
      if (courierFlatDraft) {
        setCourierFlatDraft('');
      }
      if (courierEntrance) {
        setCourierEntrance('');
      }
      if (courierFloor) {
        setCourierFloor('');
      }
      if (courierIntercom) {
        setCourierIntercom('');
      }
      if (courierQuery) {
        const { baseQuery } = splitCourierQuery(courierQuery);
        const trimmedBase = baseQuery.trim();
        const nextQuery = trimmedBase ? `${trimmedBase} ` : '';
        if (nextQuery !== courierQuery) {
          setCourierQuery(nextQuery);
        }
      }
      setSelectedCourierAddressLine2('');
      updateCourierAddress2({
        baseLine2: '',
        flatLabel: '',
        entrance: '',
        floor: '',
        intercom: ''
      });
      setCourierCost(null);
      setCourierCostError(null);
      courierMapLastSelectionRef.current = next;
      setCourierMarker(next);
      if (sameGeoKey) {
        return;
      }
      if (courierMapSelectTimeoutRef.current) {
        clearTimeout(courierMapSelectTimeoutRef.current);
      }
      courierMapSelectTimeoutRef.current = setTimeout(() => {
        geolocateCourierAddress(lat, lng, { preserveMarker: true });
      }, 500);
    },
    [
      courierEntrance,
      courierFlatDraft,
      courierFloor,
      courierIntercom,
      courierQuery,
      geolocateCourierAddress,
      updateCourierAddress2
    ]
  );

  useEffect(() => {
    return () => {
      if (courierMapSelectTimeoutRef.current) {
        clearTimeout(courierMapSelectTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isPanelOpen || panelType !== 'courier') {
      return;
    }
    const { baseQuery } = splitCourierQuery(courierQuery);
    const query = baseQuery.trim();
    if (courierSuggestTimeoutRef.current) {
      clearTimeout(courierSuggestTimeoutRef.current);
    }
    if (courierSuppressSuggestRef.current) {
      courierSuppressSuggestRef.current = false;
      setCourierSuggestions([]);
      setCourierSuggestLoading(false);
      setCourierSuggestError(null);
      setIsCourierSuggestOpen(false);
      return;
    }
    if (query.length < 4) {
      setCourierSuggestions([]);
      setCourierSuggestLoading(false);
      setCourierSuggestError(null);
      setIsCourierSuggestOpen(false);
      return;
    }
    courierSuggestTimeoutRef.current = setTimeout(() => {
      loadCourierSuggestions(query);
    }, 500);
    return () => {
      if (courierSuggestTimeoutRef.current) {
        clearTimeout(courierSuggestTimeoutRef.current);
      }
    };
  }, [courierQuery, isPanelOpen, panelType, loadCourierSuggestions]);

  useEffect(() => {
    if (!isPanelOpen || panelType !== 'courier') {
      return;
    }
    if (courierMarker || selectedCourierSuggestionData) {
      return;
    }
    if (courierAutoLocateRef.current) {
      return;
    }
    courierAutoLocateRef.current = true;
    if (!navigator.geolocation) {
      if (!courierQuery.trim()) {
        courierSuppressSuggestRef.current = true;
        setCourierQuery('г Москва ');
        setIsCourierQueryExpanded(true);
        resizeCourierQueryInput(true);
      }
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCourierMapZoom(COURIER_FOCUS_ZOOM);
        handleCourierMapSelect(latitude, longitude);
      },
      () => {
        if (!courierQuery.trim()) {
          courierSuppressSuggestRef.current = true;
          setCourierQuery('г Москва ');
          setIsCourierQueryExpanded(true);
          resizeCourierQueryInput(true);
        }
      }
    );
  }, [
    courierMarker,
    courierQuery,
    handleCourierMapSelect,
    isPanelOpen,
    panelType,
    selectedCourierSuggestionData
  ]);

  useEffect(() => {
    if (isPanelOpen) {
      return;
    }
    courierSuggestAbortRef.current?.abort();
    courierSuggestAbortRef.current = null;
    courierGeocodeAbortRef.current?.abort();
    courierGeocodeAbortRef.current = null;
    if (courierMapSelectTimeoutRef.current) {
      clearTimeout(courierMapSelectTimeoutRef.current);
      courierMapSelectTimeoutRef.current = null;
    }
    courierMapLastSelectionRef.current = null;
    courierAutoLocateRef.current = false;
      setCourierSuggestions([]);
      setCourierSuggestError(null);
      setCourierSuggestLoading(false);
      setIsCourierSuggestOpen(false);
      setIsCourierQueryExpanded(false);
      setIsCourierSuggestionSelected(false);
      setSelectedCourierSuggestionValue('');
      setSelectedCourierSuggestionData(null);
      setSelectedCourierAddressLine2('');
      setCourierFlatDraft('');
      setCourierCost(null);
      setCourierCostError(null);
      setCourierCostLoading(false);
      resizeCourierQueryInput(false);
    if (courierSuggestCloseTimeout.current) {
      clearTimeout(courierSuggestCloseTimeout.current);
      courierSuggestCloseTimeout.current = null;
    }
  }, [isPanelOpen, resizeCourierQueryInput]);

  useEffect(() => {
    if (!isPanelOpen || panelType !== 'courier') {
      return;
    }
    if (!courierAddressReady) {
      setCourierCost(null);
      setCourierCostError(null);
      return;
    }
    if (!cart?.uuid) {
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        setCourierCostLoading(true);
        setCourierCostError(null);
        const addressData = form.getValues('shippingAddress');
        const params = new URLSearchParams();
        if (addressData.address_1) {
          params.set('address_1', String(addressData.address_1));
        }
        if (addressData.address_2) {
          params.set('address_2', String(addressData.address_2));
        }
        if (addressData.city) {
          params.set('city', String(addressData.city));
        }
        if (addressData.province) {
          params.set('province', String(addressData.province));
        }
        if (addressData.postcode) {
          params.set('postcode', String(addressData.postcode));
        }
        params.set('delivery_type', 'courier');
        const response = await fetch(
          `/api/shipping/calculate-courier/${cart.uuid}/${COURIER_METHOD_ID}?${params.toString()}`
        );
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
          const rawMessage =
            data?.message ||
            data?.error?.message ||
            _('Failed to calculate delivery cost');
          throw new Error(formatCourierCalcError(rawMessage));
        }
        if (!cancelled) {
          setCourierCost(data?.data?.cost ?? null);
          setCourierCostCurrency(data?.data?.currency || cart.currency || 'RUB');
        }
      } catch (error: any) {
        if (!cancelled) {
          setCourierCost(null);
          setCourierCostError(
            error?.message || _('Failed to calculate delivery cost')
          );
        }
      } finally {
        if (!cancelled) {
          setCourierCostLoading(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [
    cart?.currency,
    cart?.uuid,
    courierAddressReady,
    form,
    isPanelOpen,
    panelType,
    selectedCourierSuggestionValue
  ]);

  useEffect(() => {
    if (!isPanelOpen || panelType !== 'courier') {
      return;
    }
    if (courierQuery.trim()) {
      return;
    }
    const address1 = form.getValues('shippingAddress.address_1') || '';
    const city = form.getValues('shippingAddress.city') || '';
    const province = form.getValues('shippingAddress.province') || '';
    const postcode = form.getValues('shippingAddress.postcode') || '';
    const display = [address1, city].filter(Boolean).join(', ');
    if (display) {
      courierSuppressSuggestRef.current = true;
      setCourierQuery(display);
      if (address1 && (city || province) && postcode) {
        setIsCourierSuggestionSelected(true);
        setSelectedCourierSuggestionValue(display);
      }
    }
  }, [isPanelOpen, panelType, courierQuery, form]);

  useEffect(() => {
    resizeCourierQueryInput();
  }, [courierQuery, resizeCourierQueryInput]);

  const clearDeliveryAddressFields = () => {
    setShippingAddressFields(
      {
        address_1: '',
        address_2: '',
        city: '',
        province: '',
        country: '',
        postcode: '',
        courier_note: ''
      },
      { preserveRecipient: true }
    );
    setCourierFlatDraft('');
    setCourierEntrance('');
    setCourierFloor('');
    setCourierIntercom('');
    setCourierNoteDraft('');
    setSelectedCourierAddressLine2('');
  };

  const clearShippingSelection = async () => {
    if (!cart?.uuid) {
      return;
    }

    try {
      const response = await fetch(`/api/carts/${cart.uuid}/clearShipping`, {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error('Failed to clear shipping');
      }
      updateCheckoutData({ shippingAddress: null, shippingMethod: null });
      clearDeliveryAddressFields();
      setSelectedPickupAddressId('');
      setSelectedCourierAddressId('');
      setSelectedPointId(undefined);
      await syncCartWithServer('clearShipping');
    } catch (error) {
      console.error('[Shipment] Failed to clear shipping selection:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : _('Failed to clear shipping selection')
      );
    }
  };

  const handleCourierSelect = async (
    address: ExtendedCustomerAddress,
    options?: { closePanel?: boolean }
  ) => {
    setSelectedCourierAddressId(getAddressKey(address));
    const addressData = mapCustomerAddressToForm(address);
    setShippingAddressFields(addressData, { preserveRecipient: true });
    if (customer) {
      const addressId = resolveAddressId(address, customerAddresses);
      if (addressId && !address.isDefault) {
        try {
          await updateAddress(addressId, { is_default: true });
        } catch (error) {
          console.error('[Shipment] Failed to set default address:', error);
          toast.error(
            error instanceof Error
              ? error.message
              : _('Failed to set default address')
          );
        }
      }
    }
    const updated = await updateShipment(courierMethod);
    if (updated && options?.closePanel !== false) {
      closePanel();
    }
  };

  const handlePickupSelect = async (
    address: ExtendedCustomerAddress,
    options?: { closePanel?: boolean }
  ) => {
    setSelectedPickupAddressId(getAddressKey(address));
    const addressData = mapCustomerAddressToForm(address);
    setShippingAddressFields(addressData, { preserveRecipient: true });
    if (customer) {
      const addressId = resolveAddressId(address, customerAddresses);
      if (addressId && !address.isDefault) {
        try {
          await updateAddress(addressId, { is_default: true });
        } catch (error) {
          console.error('[Shipment] Failed to set default address:', error);
          toast.error(
            error instanceof Error
              ? error.message
              : _('Failed to set default address')
          );
        }
      }
    }
    const updated = await updateShipment(pickupMethod, {
      ...getPickupMetaFromAddress(address),
      delivery_type: 'pickup'
    });
    if (updated && options?.closePanel !== false) {
      closePanel();
    }
  };

  const saveCourierAddress = async () => {
    if (!customer) {
      toast.error(_('Please sign in to save recipients'));
      return;
    }

    const validate = await form.trigger('shippingAddress');
    if (!validate) {
      return;
    }
    const rawAddressData = form.getValues('shippingAddress') || {};
    const addressData = {
      ...rawAddressData,
      address_2: buildCourierAddress2Value(),
      courier_note: courierNoteDraft || ''
    };
    if (!addressData.full_name || !addressData.telephone) {
      toast.error(_('Enter full name and telephone for the recipient'));
      return;
    }
    if (!courierAddressReady) {
      toast.error(_('Select a valid courier address'));
      return;
    }
    try {
      const existingCourierAddress = courierAddresses.find((address) =>
        isCourierAddressCoreMatch(address, addressData)
      );

      if (existingCourierAddress) {
        const updatePayload = {
          ...addressData,
          delivery_type: 'courier',
          is_default: true
        };
        const existingKey = getAddressKey(existingCourierAddress);
        const existingFromCustomer =
          customerAddresses.find(
            (candidate) => getAddressKey(candidate) === existingKey
          ) ||
          customerAddresses.find((candidate) =>
            isCourierAddressCoreMatch(candidate, addressData)
          ) ||
          existingCourierAddress;
        const existingAddressId = resolveAddressId(
          existingFromCustomer,
          customerAddresses
        );
        const selectedKey = getAddressKey(existingFromCustomer);
        const updateLocalAddresses = (
          updatedAddress: Record<string, any> = {}
        ) => {
          if (!customer) {
            return;
          }
          const nextAddress1 = String(
            updatedAddress.address1 ||
              updatedAddress.address_1 ||
              updatePayload.address_1 ||
              ''
          );
          const nextAddress2 = String(
            updatedAddress.address2 ||
              updatedAddress.address_2 ||
              updatePayload.address_2 ||
              ''
          );
          const nextCity = String(updatedAddress.city || updatePayload.city || '');
          const nextPostcode = String(
            updatedAddress.postcode ||
              updatedAddress.postal_code ||
              updatePayload.postcode ||
              ''
          );
          const nextCourierNote = String(
            updatedAddress.courierNote ||
              updatedAddress.courier_note ||
              updatePayload.courier_note ||
              ''
          );
          let applied = false;
          const nextAddresses = customerAddresses.map((candidate) => {
            const byKey =
              Boolean(selectedKey) && getAddressKey(candidate) === selectedKey;
            const byCore =
              !applied && isCourierAddressCoreMatch(candidate, addressData);
            if (!byKey && !byCore) {
              return {
                ...candidate,
                isDefault: false
              };
            }
            applied = true;
            return {
              ...candidate,
              ...updatePayload,
              ...updatedAddress,
              address1: nextAddress1,
              address_1: nextAddress1,
              address2: nextAddress2,
              address_2: nextAddress2,
              city: nextCity,
              postcode: nextPostcode,
              courierNote: nextCourierNote,
              courier_note: nextCourierNote,
              isDefault: true
            };
          });
          setCustomer({
            ...customer,
            addresses: nextAddresses
          } as any);
        };
        if (existingAddressId) {
          const updatedAddress = await updateAddress(
            existingAddressId,
            updatePayload
          );
          updateLocalAddresses(updatedAddress || {});
        } else {
          const updateApi = (existingFromCustomer as any)?.updateApi as
            | string
            | undefined;
          if (!updateApi) {
            throw new Error(_('Failed to resolve existing courier address ID'));
          }
          const response = await fetch(updateApi, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload)
          });
          const json = await response.json().catch(() => null);
          if (!response.ok || json?.error) {
            throw new Error(
              json?.error?.message ||
                json?.message ||
                _('Failed to update address')
            );
          }
          const updatedAddress = json?.data || {};
          updateLocalAddresses(updatedAddress);
        }

        if (selectedKey) {
          setSelectedCourierAddressId(selectedKey);
        }
      } else {
        const created = await addAddress({
          ...addressData,
          delivery_type: 'courier',
          is_default: true
        });
        if (created) {
          const createdKey = normalizeId(created.uuid || created.addressId);
          if (createdKey) {
            setSelectedCourierAddressId(createdKey);
          }
        }
      }

      const updated = await updateShipment(courierMethod, {
        delivery_type: 'courier'
      });
      if (updated) {
        closePanel();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : _('Failed to save address')
      );
    }
  };

  const handlePointSelect = async (
    pointId: number,
    _calculation: DeliveryCalculation,
    pointDetail: DeliveryPointDetail
  ) => {
    setSelectedPointId(pointId);

    const fullName = form.getValues('shippingAddress.full_name');
    const telephone = form.getValues('shippingAddress.telephone');

    if (!fullName || !telephone) {
      toast.error(_('Enter full name and telephone for the recipient'));
      return;
    }

    const pickupAddressData = {
      full_name: fullName,
      telephone,
      address_1: pointDetail.address || '',
      address_2: pointDetail.name || '',
      city: pointDetail.city || '',
      province: pointDetail.region || pointDetail.city || '',
      country: 'RU',
      postcode: pointDetail.postal_code || '000000'
    };

    const pickupMeta = {
      pickup_point_id: pointDetail.id,
      pickup_service_code: pointDetail.service_code || 'cdek',
      pickup_external_id: pointDetail.external_id || null,
      pickup_data: {
        id: pointDetail.id,
        external_id: pointDetail.external_id,
        service_code: pointDetail.service_code,
        postal_code: pointDetail.postal_code,
        city: pointDetail.city,
        address: pointDetail.address,
        region: pointDetail.region,
        name: pointDetail.name
      }
    };

    setShippingAddressFields(pickupAddressData);
    const updated = await updateShipment(pickupMethod, {
      ...pickupMeta,
      delivery_type: 'pickup'
    });
    if (updated) {
      closePanel();
    }

    if (customer) {
      const existingPickup = findPickupAddressByPoint(pickupAddresses, pointDetail);
      if (existingPickup) {
        const existingKey = getAddressKey(existingPickup);
        if (existingKey) {
          setSelectedPickupAddressId(existingKey);
        }
        const existingId = resolveAddressId(existingPickup, customerAddresses);
        if (existingId && !existingPickup.isDefault) {
          try {
            await updateAddress(existingId, { is_default: true });
          } catch (error) {
            console.error('[Shipment] Failed to set default address:', error);
            toast.error(
              error instanceof Error
                ? error.message
                : _('Failed to set default address')
            );
          }
        }
        return;
      }
      const pickupData = {
        delivery_type: 'pickup',
        pickup_point_id: pointDetail.id,
        pickup_service_code: pointDetail.service_code || 'cdek',
        pickup_external_id: pointDetail.external_id || null,
        pickup_data: {
          id: pointDetail.id,
          external_id: pointDetail.external_id,
          service_code: pointDetail.service_code,
          postal_code: pointDetail.postal_code,
          city: pointDetail.city,
          address: pointDetail.address,
          region: pointDetail.region,
          name: pointDetail.name
        }
      };

      try {
        const created = await addAddress({
          ...pickupAddressData,
          ...pickupData,
          is_default: true
        });
        if (created) {
          const createdKey = normalizeId(created.uuid || created.addressId);
          if (createdKey) {
            setSelectedPickupAddressId(createdKey);
          }
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : _('Failed to save pickup recipient')
        );
      }
    }
  };

  const hasAnyRecipient = pickupAddresses.length > 0 || courierAddresses.length > 0;
  const addressesLoaded = Boolean(customer) && !isCustomerLoading;
  const hasInvalidItems = invalidItems.length > 0;
  const invalidItemsSignature = useMemo(() => {
    const cartItems = (cart as any)?.items;
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return '';
    }
    return cartItems
      .map((item: any) => {
        const weight = item?.productWeight?.value ?? '';
        return `${item?.uuid || ''}:${item?.qty || ''}:${item?.productId || ''}:${weight}`;
      })
      .join('|');
  }, [cart?.items]);

  const loadInvalidItems = useCallback(async () => {
    if (!cart?.uuid) {
      setInvalidItems([]);
      return;
    }
    setInvalidItemsLoading(true);
    try {
      const invalidCheckUrl =
        cart?.shippingMethod === COURIER_METHOD_ID
          ? `/api/shipping/calculate-courier/${cart.uuid}/${COURIER_METHOD_ID}?check_invalid_only=1`
          : `/api/shipping/calculate/${cart.uuid}/${PICKUP_METHOD_ID}?check_invalid_only=1`;
      const response = await fetch(invalidCheckUrl);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setInvalidItems([]);
        return;
      }
      const items = data?.data?.invalid_items;
      if (Array.isArray(items) && items.length > 0) {
        setInvalidItems(items);
      } else {
        setInvalidItems([]);
      }
    } catch (error) {
      console.error('[Shipment] Failed to load invalid items:', error);
    } finally {
      setInvalidItemsLoading(false);
    }
  }, [cart?.shippingMethod, cart?.uuid]);

  const handleRemoveInvalidItems = async () => {
    if (isRemovingInvalidItems || invalidItems.length === 0) {
      return;
    }
    setIsRemovingInvalidItems(true);
    try {
      for (const item of invalidItems) {
        if (!item.cart_item_id) {
          continue;
        }
        await removeItem(String(item.cart_item_id));
      }
      await loadInvalidItems();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : _('Failed to remove items')
      );
    } finally {
      setIsRemovingInvalidItems(false);
    }
  };

  useEffect(() => {
    if (!cart?.uuid) {
      setInvalidItems([]);
      return;
    }
    loadInvalidItems();
  }, [cart?.uuid, invalidItemsSignature, loadInvalidItems]);

  useEffect(() => {
    updateCheckoutData({
      hasInvalidItems: invalidItems.length > 0
    } as any);
  }, [invalidItems.length, updateCheckoutData]);

  useEffect(() => {
    if (!addressesLoaded) {
      return;
    }
    if (hasAnyRecipient) {
      return;
    }
    if (panelType === 'courier' && isPanelOpen) {
      return;
    }
    if (courierAddressReady) {
      return;
    }
    if (!cart?.shippingMethod && !cart?.shippingAddress) {
      return;
    }
    if (clearingShippingRef.current) {
      return;
    }

    clearingShippingRef.current = true;
    clearShippingSelection().finally(() => {
      clearingShippingRef.current = false;
    });
  }, [
    addressesLoaded,
    hasAnyRecipient,
    cart?.shippingMethod,
    cart?.shippingAddress,
    cart?.uuid,
    courierAddressReady,
    isPanelOpen,
    panelType
  ]);

  useEffect(() => {
    if (autoAppliedShippingRef.current) {
      return;
    }
    if (!addressesLoaded) {
      return;
    }
    if (cart?.shippingMethod || cart?.shippingAddress) {
      return;
    }

    const preferredAddresses =
      deliveryType === 'pickup' ? pickupAddresses : courierAddresses;
    const targetAddress =
      preferredAddresses.find((address) => address.isDefault) ||
      preferredAddresses[0];
    if (!targetAddress) {
      return;
    }

    autoAppliedShippingRef.current = true;
    const targetType = normalizeDeliveryType(targetAddress);
    if (targetType !== deliveryType) {
      setDeliveryType(targetType);
      setPanelType(targetType);
    }
    if (targetType === 'pickup') {
      handlePickupSelect(targetAddress, { closePanel: false });
    } else {
      handleCourierSelect(targetAddress, { closePanel: false });
    }
  }, [
    addressesLoaded,
    cart?.shippingAddress,
    cart?.shippingMethod,
    pickupAddresses,
    courierAddresses,
    deliveryType
  ]);

  return (
    <div className="checkout-delivery">
      <h3>{_('Delivery')}</h3>

      {invalidItems.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="font-medium">
            {_('Some items are unavailable or missing weight.')}
          </div>
          <ul className="mt-2 space-y-1 text-sm text-red-700">
            {invalidItems.map((item) => (
              <li key={item.uuid || String(item.cart_item_id)}>
                {item.product_name || _('Unknown item')}
                {item.product_sku ? ` (${item.product_sku})` : ''}
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <button
              type="button"
              className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
              onClick={handleRemoveInvalidItems}
              disabled={isRemovingInvalidItems || invalidItemsLoading}
            >
              {isRemovingInvalidItems
                ? _('Removing...')
                : _('Remove items')}
            </button>
          </div>
        </div>
      )}

      <div
        className={`rounded-lg bg-white ${
          deliverySummaryLines.length > 0 ? 'border p-4' : ''
        } ${hasInvalidItems ? 'opacity-60' : ''}`}
      >
        {deliverySummaryLines.length > 0 ? (
          <div className="flex items-center gap-3">
            <div className="text-gray-500">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10a3 3 0 100-6 3 3 0 000 6z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 21s-6-5.686-6-10a6 6 0 1112 0c0 4.314-6 10-6 10z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0 space-y-1 text-xs text-gray-600">
              {deliverySummaryLines.map((line, index) => (
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
              ))}
            </div>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-700 disabled:cursor-not-allowed"
              onClick={() => openPanel(deliveryType)}
              aria-label={_('Change')}
              disabled={hasInvalidItems}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 20h4l10-10-4-4L4 16v4zM13 6l4 4"
                />
              </svg>
            </button>
          </div>
        ) : (
          <div className="checkout-button-section">
            <button
              type="button"
              className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => openPanel(deliveryType)}
              disabled={hasInvalidItems}
            >
              {_('Choose delivery address')}
            </button>
          </div>
        )}

      </div>

      {isPanelOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={isApplyingShipment ? undefined : closePanel}
          />
          <div
            className={
              panelStep === 'list'
                ? 'absolute inset-0 flex items-center justify-center p-4'
                : 'absolute inset-0'
            }
          >
            <div
              className={
                panelStep === 'list'
                  ? 'w-full max-w-md max-h-[90vh] bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden relative'
                  : 'w-full h-full bg-white shadow-xl flex flex-col relative'
              }
            >
            {isApplyingShipment && (
              <div className="absolute inset-0 z-20 bg-white/80 flex items-center justify-center">
                <div className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow">
                  {_('Applying delivery...')}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                {panelStep !== 'list' ? (
                  <button
                    type="button"
                    className="text-gray-500 hover:text-gray-800"
                    onClick={() => setPanelStep('list')}
                    aria-label={_('Back')}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                ) : null}
                <div className="text-lg font-medium">
                  {_('Delivery method')}
                </div>
              </div>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-800"
                onClick={closePanel}
              >
                x
              </button>
            </div>
            <div
              className={`flex-1 ${
                panelStep === 'detail' &&
                (panelType === 'pickup' || panelType === 'courier')
                  ? 'overflow-hidden p-0'
                  : 'overflow-y-auto p-4'
              }`}
            >
              {panelStep === 'list' && (
                <div className="flex justify-center mb-6">
                  <div className="inline-flex items-center rounded-full border bg-gray-50">
                    <button
                      type="button"
                      className={`px-4 py-2 rounded-full text-sm ${
                        panelType === 'pickup'
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600'
                      }`}
                      onClick={() => handleDeliveryTypeChange('pickup')}
                    >
                      {pickupMethod.name}
                    </button>
                    <button
                      type="button"
                      className={`px-4 py-2 rounded-full text-sm ${
                        panelType === 'courier'
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600'
                      }`}
                      onClick={() => handleDeliveryTypeChange('courier')}
                    >
                      {courierMethod.name}
                    </button>
                  </div>
                </div>
              )}
              {panelStep === 'list' ? (
                <div className="space-y-6">
                  {panelType === 'pickup' ? (
                    <div className="space-y-4">
                      <button
                        type="button"
                        className="inline-flex items-center rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => {
                          setSelectedPickupAddressId('');
                          setSelectedPointId(undefined);
                          setPanelStep('detail');
                        }}
                      >
                        {_('Add pickup point')}
                      </button>
                      {pickupAddresses.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                          {displayPickupAddresses.map((address) => {
                            const addressId = getAddressKey(address);
                            const isSelected =
                              addressId !== '' && addressId === selectedPickupAddressId;
                            const isApplied =
                              cart?.shippingMethod === PICKUP_METHOD_ID &&
                              (address.isDefault ||
                                isPickupAddressMatch(address, shippingAddress));
                            return (
                              <div
                                key={address.uuid}
                                className={`border rounded p-4 cursor-pointer transition relative ${
                                  isSelected
                                    ? 'border-gray-900 bg-gray-50'
                                    : 'border-gray-200 hover:border-gray-400'
                                }`}
                                onClick={() => {
                                  if (addressId) {
                                    setSelectedPickupAddressId(addressId);
                                  }
                                }}
                              >
                                <div className="relative pr-10">
                                  <button
                                    type="button"
                                    className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                                    onClick={async (event) => {
                                      event.stopPropagation();
                                      try {
                                        const addressId = resolveAddressId(
                                          address,
                                          customerAddresses
                                        );
                                        const targetKey = getAddressKey(address);
                                        const updatedAddresses = customerAddresses.filter(
                                          (item) => {
                                            if (targetKey) {
                                              return getAddressKey(item) !== targetKey;
                                            }
                                            if (address.uuid) {
                                              return item.uuid !== address.uuid;
                                            }
                                            const targetId = getAddressIdValue(address);
                                            return targetId
                                              ? getAddressIdValue(item) !== targetId
                                              : true;
                                          }
                                        );
                                        if (addressId) {
                                          await deleteAddress(addressId);
                                        } else if (address.deleteApi && customer) {
                                          const response = await fetch(
                                            address.deleteApi,
                                            {
                                              method: 'DELETE',
                                              headers: {
                                                'Content-Type': 'application/json'
                                              }
                                            }
                                          );
                                          const json = await response.json();
                                          if (!response.ok) {
                                            throw new Error(
                                              json.error?.message ||
                                                _('Failed to delete recipient')
                                            );
                                          }
                                          if (json.error) {
                                            throw new Error(
                                              json.error.message ||
                                                _('Failed to delete recipient')
                                            );
                                          }
                                          setCustomer({
                                            ...customer,
                                            addresses: customerAddresses.filter(
                                              (item) => item.uuid !== address.uuid
                                            )
                                          });
                                        } else {
                                          toast.error(_('Recipient id missing'));
                                          return;
                                        }
                                        const wasSelected =
                                          getAddressKey(address) === selectedPickupAddressId;
                                        const remainingPickupAddresses = updatedAddresses.filter(
                                          (item) => normalizeDeliveryType(item) === 'pickup'
                                        );
                                        const remainingCourierAddresses = updatedAddresses.filter(
                                          (item) => normalizeDeliveryType(item) === 'courier'
                                        );
                                        let clearedShipping = false;
                                        if (wasSelected) {
                                          if (remainingPickupAddresses.length > 0) {
                                            const nextPickup =
                                              remainingPickupAddresses.find(
                                                (item) => item.isDefault
                                              ) || remainingPickupAddresses[0];
                                            await handlePickupSelect(nextPickup, {
                                              closePanel: false
                                            });
                                          } else {
                                            setSelectedPickupAddressId('');
                                            if (remainingCourierAddresses.length > 0) {
                                              const nextCourier =
                                                remainingCourierAddresses.find(
                                                  (item) => item.isDefault
                                                ) || remainingCourierAddresses[0];
                                              await handleCourierSelect(nextCourier, {
                                                closePanel: false
                                              });
                                            } else {
                                              await clearShippingSelection();
                                              clearedShipping = true;
                                            }
                                          }
                                        }
                                        if (
                                          remainingPickupAddresses.length === 0 &&
                                          remainingCourierAddresses.length === 0
                                        ) {
                                          if (!clearedShipping) {
                                            await clearShippingSelection();
                                          }
                                        }
                                        toast.success(_('Recipient deleted'));
                                      } catch (error) {
                                        toast.error(
                                          error instanceof Error
                                            ? error.message
                                            : _('Failed to delete recipient')
                                        );
                                      }
                                    }}
                                    aria-label={_('Delete')}
                                    title={_('Delete')}
                                  >
                                    <svg
                                      viewBox="0 0 24 24"
                                      className="h-4 w-4"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M3 6h18" />
                                      <path d="M8 6V4h8v2" />
                                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                      <path d="M10 11v6M14 11v6" />
                                    </svg>
                                  </button>
                                  <div className="space-y-1 text-xs text-gray-600">
                                    {getPickupSummaryLines(address).map(
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
                                </div>
                                {isSelected && !isApplied ? (
                                  <div className="mt-4">
                                    <button
                                      type="button"
                                      className="w-full rounded-lg bg-gray-900 py-2 text-sm text-white"
                                      onClick={() => handlePickupSelect(address)}
                                    >
                                      {_('Pick up here')}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          {_('No pickup recipients yet')}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <button
                        type="button"
                        className="inline-flex items-center rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setPanelStep('detail')}
                      >
                        {_('Add address')}
                      </button>
                      {courierAddresses.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                          {displayCourierAddresses.map((address) => {
                            const addressId = getAddressKey(address);
                            const isSelected =
                              addressId !== '' && addressId === selectedCourierAddressId;
                            const isApplied =
                              cart?.shippingMethod === COURIER_METHOD_ID &&
                              isCourierAddressMatch(address, shippingAddress);
                            return (
                              <div
                                key={address.uuid}
                                className={`border rounded p-4 cursor-pointer transition relative ${
                                  isSelected
                                    ? 'border-gray-900 bg-gray-50'
                                    : 'border-gray-200 hover:border-gray-400'
                                }`}
                                onClick={() => {
                                  if (addressId) {
                                    setSelectedCourierAddressId(addressId);
                                  }
                                }}
                              >
                                <div className="relative pr-10">
                                  <button
                                    type="button"
                                    className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                                    onClick={async (event) => {
                                      event.stopPropagation();
                                      try {
                                        const addressId = resolveAddressId(
                                          address,
                                          customerAddresses
                                        );
                                        const targetKey = getAddressKey(address);
                                        const updatedAddresses = customerAddresses.filter(
                                          (item) => {
                                            if (targetKey) {
                                              return getAddressKey(item) !== targetKey;
                                            }
                                            if (address.uuid) {
                                              return item.uuid !== address.uuid;
                                            }
                                            const targetId = getAddressIdValue(address);
                                            return targetId
                                              ? getAddressIdValue(item) !== targetId
                                              : true;
                                          }
                                        );
                                        if (addressId) {
                                          await deleteAddress(addressId);
                                        } else if (address.deleteApi && customer) {
                                          const response = await fetch(
                                            address.deleteApi,
                                            {
                                              method: 'DELETE',
                                              headers: {
                                                'Content-Type': 'application/json'
                                              }
                                            }
                                          );
                                          const json = await response.json();
                                          if (!response.ok) {
                                            throw new Error(
                                              json.error?.message ||
                                                _('Failed to delete recipient')
                                            );
                                          }
                                          if (json.error) {
                                            throw new Error(
                                              json.error.message ||
                                                _('Failed to delete recipient')
                                            );
                                          }
                                          setCustomer({
                                            ...customer,
                                            addresses: customerAddresses.filter(
                                              (item) => item.uuid !== address.uuid
                                            )
                                          });
                                        } else {
                                          toast.error(_('Recipient id missing'));
                                          return;
                                        }
                                        const wasSelected =
                                          getAddressKey(address) === selectedCourierAddressId;
                                        const remainingPickupAddresses = updatedAddresses.filter(
                                          (item) => normalizeDeliveryType(item) === 'pickup'
                                        );
                                        const remainingCourierAddresses = updatedAddresses.filter(
                                          (item) => normalizeDeliveryType(item) === 'courier'
                                        );
                                        let clearedShipping = false;
                                        if (wasSelected) {
                                          if (remainingCourierAddresses.length > 0) {
                                            const nextCourier =
                                              remainingCourierAddresses.find(
                                                (item) => item.isDefault
                                              ) || remainingCourierAddresses[0];
                                            await handleCourierSelect(nextCourier, {
                                              closePanel: false
                                            });
                                          } else {
                                            setSelectedCourierAddressId('');
                                            if (remainingPickupAddresses.length > 0) {
                                              const nextPickup =
                                                remainingPickupAddresses.find(
                                                  (item) => item.isDefault
                                                ) || remainingPickupAddresses[0];
                                              await handlePickupSelect(nextPickup, {
                                                closePanel: false
                                              });
                                            } else {
                                              await clearShippingSelection();
                                              clearedShipping = true;
                                            }
                                          }
                                        }
                                        if (
                                          remainingPickupAddresses.length === 0 &&
                                          remainingCourierAddresses.length === 0
                                        ) {
                                          if (!clearedShipping) {
                                            await clearShippingSelection();
                                          }
                                        }
                                        toast.success(_('Recipient deleted'));
                                      } catch (error) {
                                        toast.error(
                                          error instanceof Error
                                            ? error.message
                                            : _('Failed to delete recipient')
                                        );
                                      }
                                    }}
                                    aria-label={_('Delete')}
                                    title={_('Delete')}
                                  >
                                    <svg
                                      viewBox="0 0 24 24"
                                      className="h-4 w-4"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M3 6h18" />
                                      <path d="M8 6V4h8v2" />
                                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                      <path d="M10 11v6M14 11v6" />
                                    </svg>
                                  </button>
                                  <div className="space-y-1 text-xs text-gray-600">
                                    {getCourierSummaryLines(address).map(
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
                                </div>
                                {isSelected && !isApplied ? (
                                  <div className="mt-4">
                                    <button
                                      type="button"
                                      className="w-full rounded-lg bg-gray-900 py-2 text-sm text-white"
                                      onClick={() => handleCourierSelect(address)}
                                    >
                                      {_('Deliver here')}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          {_('No courier recipients yet')}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              ) : panelType === 'pickup' ? (
                <div className="h-full">
                  <DeliveryMapPicker
                    onPointSelect={handlePointSelect}
                    selectedPointId={selectedPointId}
                    cartWeight={cartWeight}
                    cartLength={cartDimensions.length}
                    cartWidth={cartDimensions.width}
                    cartHeight={cartDimensions.height}
                    height="100%"
                  />
                </div>
              ) : (
                <div className="relative overflow-hidden bg-white h-full min-h-0">
                  <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[360px_1fr]">
                    <aside className="border-r bg-white h-full min-h-0">
                      <div className="p-4 border-b">
                        <div className="text-lg font-semibold">
                          {_('Where should we deliver?')}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {_('Type an address or pick a point on the map.')}
                        </div>
                      </div>
                      <div className="p-4 space-y-4 overflow-y-auto h-full min-h-0">
                        <div className="space-y-2">
                          <div className="text-xs text-gray-500">
                            {_('Address')}
                          </div>
                          <div className="relative">
                            <textarea
                              ref={courierQueryInputRef}
                              value={courierQuery}
                              onFocus={() => {
                                if (courierSuggestCloseTimeout.current) {
                                  clearTimeout(courierSuggestCloseTimeout.current);
                                  courierSuggestCloseTimeout.current = null;
                                }
                                setIsCourierQueryExpanded(true);
                                setIsCourierSuggestOpen(true);
                                resizeCourierQueryInput(true);
                              }}
                              onBlur={() => {
                                courierSuggestCloseTimeout.current = setTimeout(() => {
                                  setIsCourierSuggestOpen(false);
                                }, 150);
                                if (courierQuery.trim() && !isCourierSuggestionSelected) {
                                  setCourierSuggestError(
                                    _('Select an address from suggestions.')
                                  );
                                }
                              }}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                const { flatLabel } = splitCourierQuery(nextValue);
                                courierSuppressSuggestRef.current = false;
                                setCourierQuery(nextValue);
                                setIsCourierSuggestOpen(true);
                                if (courierSuggestError) {
                                  setCourierSuggestError(null);
                                }
                                setCourierFlatDraft(flatLabel);
                                if (
                                  isCourierSuggestionSelected &&
                                  !nextValue
                                    .trim()
                                    .startsWith(selectedCourierSuggestionValue)
                                ) {
                                  setIsCourierSuggestionSelected(false);
                                  setSelectedCourierSuggestionValue('');
                                  setSelectedCourierSuggestionData(null);
                                  setSelectedCourierAddressLine2('');
                                  setCourierCost(null);
                                  setCourierCostError(null);
                                  clearDeliveryAddressFields();
                                  setCourierMarker(null);
                                } else if (
                                  isCourierSuggestionSelected &&
                                  flatLabel
                                ) {
                                  updateCourierAddress2({ flatLabel });
                                }
                              }}
                              onInput={(event) => {
                                const target = event.currentTarget;
                                target.style.height = 'auto';
                                target.style.height = `${target.scrollHeight}px`;
                              }}
                              placeholder={_('Start typing the address')}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none overflow-hidden"
                              rows={1}
                            />
                            {courierSuggestLoading ? (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                                {_('Loading...')}
                              </div>
                            ) : null}
                          </div>
                          {courierSuggestError ? (
                            <div className="text-xs text-red-600">
                              {courierSuggestError}
                            </div>
                          ) : null}
                          {isCourierSuggestOpen &&
                          courierSuggestions.length > 0 ? (
                            <div className="border rounded-lg bg-white shadow-sm max-h-60 overflow-y-auto">
                              {courierSuggestions.map((suggestion, index) => {
                                const hint = [
                                  suggestion.data?.city || suggestion.data?.settlement,
                                  suggestion.data?.region,
                                  suggestion.data?.postal_code
                                ]
                                  .filter(Boolean)
                                  .join(', ');
                                const baseValue = suggestion.value || '';
                                const displayValue = courierFlatDraft
                                  ? `${baseValue}, ${courierFlatDraft}`
                                  : baseValue;
                                return (
                                  <button
                                    key={`${suggestion.value || 'suggestion'}-${index}`}
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-b-0"
                                    onMouseDown={(event) => {
                                      event.preventDefault();
                                    }}
                                    onClick={() => applyCourierSuggestion(suggestion)}
                                  >
                                    <div className="font-medium text-gray-900">
                                      {displayValue}
                                    </div>
                                    {hint ? (
                                      <div className="text-xs text-gray-500 mt-0.5">
                                        {hint}
                                      </div>
                                    ) : null}
                                  </button>
                                );
                              })}
                              <div className="px-3 py-2 text-[11px] text-gray-500 bg-gray-50 text-center">
                                {_('End of suggestions')}
                              </div>
                            </div>
                          ) : null}
                          {courierQuery &&
                          !courierSuggestLoading &&
                          isCourierSuggestOpen &&
                          !courierSuggestions.length ? (
                            <div className="text-xs text-gray-500">
                              {_('No matches. Keep typing to refine.')}
                            </div>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500">
                              {_('Entrance')}
                            </div>
                            <input
                              type="text"
                              value={courierEntrance}
                              onChange={(event) => {
                                const next = event.target.value;
                                setCourierEntrance(next);
                                updateCourierAddress2({ entrance: next });
                              }}
                              placeholder={_('Entrance')}
                              className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500">
                              {_('Floor')}
                            </div>
                            <input
                              type="text"
                              value={courierFloor}
                              onChange={(event) => {
                                const next = event.target.value;
                                setCourierFloor(next);
                                updateCourierAddress2({ floor: next });
                              }}
                              placeholder={_('Floor')}
                              className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500">
                              {_('Intercom')}
                            </div>
                            <input
                              type="text"
                              value={courierIntercom}
                              onChange={(event) => {
                                const next = event.target.value;
                                setCourierIntercom(next);
                                updateCourierAddress2({ intercom: next });
                              }}
                              placeholder={_('Intercom')}
                              className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs text-gray-500">
                            {_('Courier note')}
                          </div>
                          <textarea
                            value={courierNoteDraft}
                            onChange={(event) => {
                              const next = event.target.value;
                              setCourierNoteDraft(next);
                              form.setValue('shippingAddress.courier_note', next);
                            }}
                            placeholder={_('Comment for the courier')}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                            rows={2}
                          />
                        </div>

                        <button
                          type="button"
                          className="inline-flex items-center gap-2 text-sm text-blue-600"
                        onClick={() => {
                            if (!navigator.geolocation) {
                              toast.error(_('Geolocation is not available'));
                              return;
                            }
                            navigator.geolocation.getCurrentPosition(
                              (position) => {
                                const { latitude, longitude } = position.coords;
                                setCourierMapZoom(COURIER_FOCUS_ZOOM);
                                handleCourierMapSelect(latitude, longitude);
                              },
                              () => {
                                toast.error(_('Unable to detect your location'));
                              }
                            );
                          }}
                        >
                          {_('Detect location')}
                        </button>

                        <div className="space-y-2">
                          {courierCostLoading ? (
                            <div className="text-xs text-gray-500">
                              {_('Calculating delivery cost...')}
                            </div>
                          ) : null}
                          {courierCostError ? (
                            <div className="text-xs text-red-600">
                              {courierCostError}
                            </div>
                          ) : null}
                          {courierCost !== null && !courierCostLoading ? (
                            <div className="bg-gray-50 border rounded-md p-3 text-center">
                              <div className="text-xs text-gray-500">
                                {_('Delivery cost')}
                              </div>
                              <div className="text-lg font-semibold">
                                {courierCost} {courierCostCurrency}
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="pt-2">
                          <button
                            type="button"
                            className="w-full rounded-lg bg-gray-900 py-3 text-sm font-medium text-white disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70"
                            onClick={saveCourierAddress}
                            disabled={
                              fetchingShippingMethods ||
                              courierCostLoading ||
                              courierGeoLoading ||
                              courierSuggestLoading ||
                              courierCost === null ||
                              Boolean(courierCostError) ||
                              !courierAddressReady
                            }
                          >
                            {_('Deliver here')}
                          </button>
                        </div>
                      </div>
                    </aside>

                    <div className="relative min-h-0 overflow-hidden">
                      <CourierMapPicker
                        marker={courierMarker}
                        onSelect={handleCourierMapSelect}
                        focusZoom={courierMapZoom}
                        onZoomApplied={() => setCourierMapZoom(null)}
                        height="100%"
                      />
                      {courierGeoLoading ? (
                        <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-sm text-gray-700">
                          {_('Updating address...')}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {isRecipientPanelOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={closeRecipientPanel} />
          <div className="relative z-10 flex h-full w-full items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="text-lg font-medium">{_('Recipient')}</div>
                <button
                  type="button"
                  className="text-gray-500 hover:text-gray-800"
                  onClick={closeRecipientPanel}
                >
                  x
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {recipientPanelStep === 'list' ? (
                  <div className="space-y-4">
                    <button
                      type="button"
                      className="text-sm text-blue-600"
                      onClick={() => {
                        primeRecipientDraft(
                          watchedShippingAddress?.full_name ||
                            shippingAddress?.fullName ||
                            customer?.fullName ||
                            '',
                          watchedShippingAddress?.telephone ||
                            shippingAddress?.telephone ||
                            customerPhone ||
                            ''
                        );
                        setRecipientPanelStep('add');
                      }}
                    >
                      + {_('Add recipient')}
                    </button>

                    {recipientOptions.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4">
                        {recipientOptions.map((recipient) => {
                          const isSelected = recipient.key === selectedRecipientKey;
                          const rawRecipient = customerRecipients.find(
                            (item) =>
                              getRecipientKey(
                                item.fullName || '',
                                item.telephone || ''
                              ) === recipient.key
                          );
                          const canDelete = !rawRecipient?.isDefault;
                          return (
                            <div
                              key={recipient.key}
                              className={`border rounded p-4 cursor-pointer transition ${
                                isSelected
                                  ? 'border-gray-900 bg-gray-50'
                                  : 'border-gray-200 hover:border-gray-400'
                              }`}
                              onClick={() => {
                                void applyRecipientSelection(
                                  recipient.fullName,
                                  recipient.telephone
                                );
                              }}
                            >
                              <div className="relative pr-10">
                                {canDelete ? (
                                  <button
                                    type="button"
                                    className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                                    onClick={async (event) => {
                                      event.stopPropagation();
                                      if (!rawRecipient?.deleteApi || !customer) {
                                        toast.error(_('Delete recipient is not available'));
                                        return;
                                      }
                                      try {
                                        const response = await fetch(
                                          rawRecipient.deleteApi,
                                          { method: 'DELETE' }
                                        );
                                        const json = await response.json();
                                        if (!response.ok) {
                                          throw new Error(
                                            json.error?.message ||
                                              _('Failed to delete recipient')
                                          );
                                        }
                                        if (json.error) {
                                          throw new Error(
                                            json.error.message ||
                                              _('Failed to delete recipient')
                                          );
                                        }
                                        const updatedRecipients = customerRecipients.filter(
                                          (item) => item.uuid !== rawRecipient.uuid
                                        );
                                        setCustomer({
                                          ...customer,
                                          recipients: updatedRecipients
                                        } as any);
                                        if (selectedRecipientKey === recipient.key) {
                                          const fallbackRecipient =
                                            customer && (customer.fullName || customerPhone)
                                              ? {
                                                  fullName: customer.fullName,
                                                  telephone: customerPhone,
                                                  isDefault: true
                                                }
                                              : null;
                                          const nextRecipient =
                                            updatedRecipients.find((item) => item.isDefault) ||
                                            updatedRecipients[0] ||
                                            fallbackRecipient;
                                          const nextName = nextRecipient?.fullName || '';
                                          const nextPhone = nextRecipient?.telephone || '';
                                          const nextKey = getRecipientKey(nextName, nextPhone);
                                          if (nextKey) {
                                            setSelectedRecipientKey(nextKey);
                                          } else {
                                            setSelectedRecipientKey('');
                                          }
                                          if (nextName || nextPhone) {
                                            setShippingAddressFields({
                                              full_name: nextName,
                                              telephone: nextPhone
                                            });
                                            primeRecipientDraft(nextName, nextPhone);
                                          }
                                        }
                                        toast.success(_('Recipient deleted'));
                                      } catch (error) {
                                        toast.error(
                                          error instanceof Error
                                            ? error.message
                                            : _('Failed to delete recipient')
                                        );
                                      }
                                    }}
                                    aria-label={_('Delete')}
                                    title={_('Delete')}
                                  >
                                    <svg
                                      viewBox="0 0 24 24"
                                      className="h-4 w-4"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M3 6h18" />
                                      <path d="M8 6V4h8v2" />
                                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                      <path d="M10 11v6M14 11v6" />
                                    </svg>
                                  </button>
                                ) : null}
                                <div className="text-sm font-medium">
                                  {recipient.fullName || _('Unnamed recipient')}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {recipient.telephone || ''}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        {_('No recipients yet')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <button
                      type="button"
                      className="text-sm text-gray-500"
                      onClick={() => setRecipientPanelStep('list')}
                    >
                      {_('Back')}
                    </button>

                    <NameAndTelephone
                      fullName={watchedRecipient?.full_name || ''}
                      telephone={watchedRecipient?.telephone || ''}
                      getFieldName={(field) => `recipient.${field}`}
                    />

                    <button
                      type="button"
                      className="w-full rounded-lg bg-gray-900 py-2 text-sm text-white"
                      onClick={() => {
                        void applyRecipientSelection(
                          form.getValues('recipient.full_name'),
                          form.getValues('recipient.telephone')
                        );
                      }}
                    >
                      {_('Select recipient')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

