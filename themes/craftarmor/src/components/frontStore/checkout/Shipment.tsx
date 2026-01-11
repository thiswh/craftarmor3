import React, { useEffect, useMemo, useRef, useState } from 'react';
import DeliveryMapPicker from '../../../pages/checkout/DeliveryMapPicker.js';
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
  postcode: address.postcode || ''
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
  const currentKeySet = new Set(current.map((item) => getAddressKey(item)));
  const filtered = ordered.filter((item) =>
    currentKeySet.has(getAddressKey(item))
  );
  const filteredKeySet = new Set(filtered.map((item) => getAddressKey(item)));
  const appended = current.filter(
    (item) => !filteredKeySet.has(getAddressKey(item))
  );
  return [...filtered, ...appended];
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
  const [orderedPickupAddresses, setOrderedPickupAddresses] = useState<
    ExtendedCustomerAddress[]
  >([]);
  const [orderedCourierAddresses, setOrderedCourierAddresses] = useState<
    ExtendedCustomerAddress[]
  >([]);
  const defaultRecipientCreatedRef = useRef(false);
  const bodyOverflowRef = useRef<string | null>(null);
  const panelOpenRef = useRef(false);

  const { data: cart, loadingStates } = useCartState();
  const {
    addShippingAddress,
    addShippingMethod,
    fetchAvailableShippingMethods,
    syncCartWithServer
  } = useCartDispatch();
  const { form } = useCheckout();
  const { updateCheckoutData } = useCheckoutDispatch();
  const { customer, isLoading: isCustomerLoading } = useCustomer();
  const { addAddress, deleteAddress, setCustomer } = useCustomerDispatch();

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

  const openPanel = (type: DeliveryType) => {
    setPanelType(type);
    setPanelStep('list');
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
  };

  useEffect(() => {
    const wasOpen = panelOpenRef.current;
    const closedNow = wasOpen && !isPanelOpen;
    if (closedNow) {
      setOrderedPickupAddresses([]);
      setOrderedCourierAddresses([]);
    }

    if (isPanelOpen && panelStep === 'list') {
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
    selectedPickupAddressId,
    selectedCourierAddressId
  ]);

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
    setDeliveryType(type);
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

  const summaryAddress =
    deliveryType === 'pickup'
      ? selectedPickupAddress || shippingAddress
      : selectedCourierAddress || shippingAddress;
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
    if (address2) {
      lines.push(address2);
    }
    if (detailLine) {
      lines.push(detailLine);
    }

    return lines.length > 0 ? lines : [];
  }, [deliveryType, pickupSummaryData, summaryAddress]);

  const updateShipment = async (
    method: { code: string; name: string },
    extraAddressData?: Record<string, unknown>
  ) => {
    if (isApplyingShipment) {
      return false;
    }
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
      updateCheckoutData({ shippingAddress: updatedShippingAddress });
      await addShippingMethod(method.code, method.name);
      updateCheckoutData({
        shippingAddress: updatedShippingAddress,
        shippingMethod: method.code
      });
      return true;
    } catch (error) {
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

  const clearDeliveryAddressFields = () => {
    setShippingAddressFields(
      {
        address_1: '',
        address_2: '',
        city: '',
        province: '',
        country: '',
        postcode: ''
      },
      { preserveRecipient: true }
    );
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
    const updated = await updateShipment(pickupMethod, getPickupMetaFromAddress(address));
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
    const addressData = form.getValues('shippingAddress');
    if (!addressData.full_name || !addressData.telephone) {
      toast.error(_('Enter full name and telephone for the recipient'));
      return;
    }
    try {
      const created = await addAddress({
        ...addressData,
        delivery_type: 'courier'
      });
      if (created) {
        const createdKey = normalizeId(created.uuid || created.addressId);
        if (createdKey) {
          setSelectedCourierAddressId(createdKey);
        }
      }
      const updated = await updateShipment(courierMethod);
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
    const updated = await updateShipment(pickupMethod, pickupMeta);
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
          ...pickupData
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

  useEffect(() => {
    if (!addressesLoaded) {
      return;
    }
    if (hasAnyRecipient) {
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
    cart?.uuid
  ]);

  return (
    <div className="checkout-delivery">
      <h3>{_('Delivery')}</h3>

      <div
        className={`rounded-lg bg-white ${
          deliverySummaryLines.length > 0 ? 'border p-4' : ''
        }`}
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
              className="text-gray-400 hover:text-gray-700"
              onClick={() => openPanel(deliveryType)}
              aria-label={_('Change')}
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
                panelStep === 'detail' && panelType === 'pickup'
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
                        className="text-sm text-blue-600"
                        onClick={() => {
                          setSelectedPickupAddressId('');
                          setSelectedPointId(undefined);
                          setPanelStep('detail');
                        }}
                      >
                        + {_('Add pickup point')}
                      </button>
                      {pickupAddresses.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                          {displayPickupAddresses.map((address) => {
                            const addressId = getAddressKey(address);
                            const isSelected =
                              addressId !== '' && addressId === selectedPickupAddressId;
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
                                {isSelected ? (
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
                        className="text-sm text-blue-600"
                        onClick={() => setPanelStep('detail')}
                      >
                        + {_('Add address')}
                      </button>
                      {courierAddresses.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                          {displayCourierAddresses.map((address) => {
                            const addressId = getAddressKey(address);
                            const isSelected =
                              addressId !== '' && addressId === selectedCourierAddressId;
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
                                  <DeliveryAddressSummary address={address} />
                                </div>
                                {isSelected ? (
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
                <div className="space-y-6">
                  <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
                    <div className="space-y-6">
                      <AddressOnlyForm
                        fieldNamePrefix="shippingAddress"
                        address={shippingAddress}
                      />
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="px-4 py-2 border border-gray-300 rounded"
                          onClick={saveCourierAddress}
                          disabled={fetchingShippingMethods}
                        >
                          {_('Use this address')}
                        </button>
                      </div>
                    </div>

                    <div className="hidden lg:flex h-full min-h-[420px] rounded-lg border bg-gray-50 items-center justify-center text-sm text-gray-500">
                      {_('Map preview will appear after address search.')}
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
