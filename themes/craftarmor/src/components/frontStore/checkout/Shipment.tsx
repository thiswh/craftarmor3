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
import { AddressSummary } from '@components/common/customer/address/AddressSummary.jsx';
import CustomerAddressForm from '@components/frontStore/customer/address/addressForm/Index.js';
import { NameAndTelephone } from '@components/frontStore/customer/address/addressForm/NameAndTelephone.js';
import {
  useCustomer,
  useCustomerDispatch
} from '@components/frontStore/customer/CustomerContext.jsx';
import type { ExtendedCustomerAddress } from '@components/frontStore/customer/CustomerContext.jsx';
import { _ } from '@evershop/evershop/lib/locale/translate/_';
import { useWatch } from 'react-hook-form';
import { toast } from 'react-toastify';

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

const normalizeDeliveryType = (address: ExtendedCustomerAddress): DeliveryType =>
  address.deliveryType === 'pickup' ? 'pickup' : 'courier';

const normalizeId = (value?: string | number | null) =>
  value === undefined || value === null ? '' : String(value);

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

export function Shipment() {
  const [selectedPointId, setSelectedPointId] = useState<number | undefined>();
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('pickup');
  const [panelType, setPanelType] = useState<DeliveryType>('pickup');
  const [panelStep, setPanelStep] = useState<'list' | 'detail'>('list');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedPickupAddressId, setSelectedPickupAddressId] = useState<string>('');
  const [selectedCourierAddressId, setSelectedCourierAddressId] = useState<string>('');

  const { data: cart, loadingStates } = useCartState();
  const {
    addShippingAddress,
    addShippingMethod,
    fetchAvailableShippingMethods
  } = useCartDispatch();
  const { form } = useCheckout();
  const { updateCheckoutData } = useCheckoutDispatch();
  const { customer } = useCustomer();
  const { addAddress, updateAddress, deleteAddress } = useCustomerDispatch();

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
  const pickupAddresses = useMemo(
    () =>
      customerAddresses.filter(
        (address) => normalizeDeliveryType(address) === 'pickup'
      ),
    [customerAddresses]
  );
  const courierAddresses = useMemo(
    () =>
      customerAddresses.filter(
        (address) => normalizeDeliveryType(address) === 'courier'
      ),
    [customerAddresses]
  );

  const selectedPickupAddress = useMemo(
    () =>
      pickupAddresses.find(
        (address) => normalizeId(address.addressId) === selectedPickupAddressId
      ),
    [pickupAddresses, selectedPickupAddressId]
  );
  const selectedCourierAddress = useMemo(
    () =>
      courierAddresses.find(
        (address) => normalizeId(address.addressId) === selectedCourierAddressId
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

  const handleDeliveryTypeChange = (type: DeliveryType) => {
    setDeliveryType(type);
    if (isPanelOpen) {
      setPanelType(type);
      setPanelStep('list');
    }
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
      setSelectedPickupAddressId(normalizeId(defaultPickup.addressId));
    }
  }, [pickupAddresses, selectedPickupAddressId]);

  useEffect(() => {
    if (!selectedCourierAddressId && courierAddresses.length > 0) {
      const defaultCourier =
        courierAddresses.find((address) => address.isDefault) || courierAddresses[0];
      setSelectedCourierAddressId(normalizeId(defaultCourier.addressId));
    }
  }, [courierAddresses, selectedCourierAddressId]);

  const summaryAddress =
    deliveryType === 'pickup'
      ? selectedPickupAddress || shippingAddress
      : selectedCourierAddress || shippingAddress;

  const summaryLines = useMemo(() => {
    if (!summaryAddress) {
      return [_('No recipient selected yet')];
    }

    const lines: string[] = [];
    const fullName = summaryAddress.fullName || summaryAddress.full_name || '';
    const telephone = summaryAddress.telephone || '';
    const nameLine = [fullName, telephone].filter(Boolean).join(' / ');
    if (nameLine) {
      lines.push(nameLine);
    }

    const address1 = summaryAddress.address1 || summaryAddress.address_1 || '';
    const address2 = summaryAddress.address2 || summaryAddress.address_2 || '';
    const addressLine = [address1, address2].filter(Boolean).join(', ');
    if (addressLine) {
      lines.push(addressLine);
    }

    const province =
      summaryAddress.province?.code ||
      summaryAddress.province?.name ||
      summaryAddress.province ||
      '';
    const city = summaryAddress.city || '';
    const postcode = summaryAddress.postcode || '';
    const locationLine = [city, province, postcode].filter(Boolean).join(', ');
    if (locationLine) {
      lines.push(locationLine);
    }

    return lines.length > 0 ? lines : [_('No recipient selected yet')];
  }, [summaryAddress]);

  const updateShipment = async (method: { code: string; name: string }) => {
    try {
      const validate = await form.trigger('shippingAddress');
      if (!validate) {
        return false;
      }
      const updatedShippingAddress = form.getValues('shippingAddress');

      await addShippingAddress(updatedShippingAddress);
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
    }
  };

  const setShippingAddressFields = (addressData: Record<string, string>) => {
    Object.entries(addressData).forEach(([key, value]) => {
      form.setValue(`shippingAddress.${key}`, value || '');
    });
  };

  const handleCourierSelect = async (address: ExtendedCustomerAddress) => {
    setSelectedCourierAddressId(normalizeId(address.addressId));
    const addressData = mapCustomerAddressToForm(address);
    setShippingAddressFields(addressData);
    await updateShipment(courierMethod);
  };

  const handlePickupSelect = async (address: ExtendedCustomerAddress) => {
    setSelectedPickupAddressId(normalizeId(address.addressId));
    const addressData = mapCustomerAddressToForm(address);
    setShippingAddressFields(addressData);
    await updateShipment(pickupMethod);
  };

  const saveCourierRecipient = async () => {
    if (!customer) {
      toast.error(_('Please sign in to save recipients'));
      return;
    }

    const validate = await form.trigger('shippingAddress');
    if (!validate) {
      return;
    }
    const addressData = form.getValues('shippingAddress');
    try {
      await addAddress({
        ...addressData,
        delivery_type: 'courier'
      });
      toast.success(_('Recipient saved'));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : _('Failed to save recipient')
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

    setShippingAddressFields(pickupAddressData);
    await updateShipment(pickupMethod);

    if (customer) {
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
        if (selectedPickupAddressId) {
          await updateAddress(selectedPickupAddressId, {
            ...pickupAddressData,
            ...pickupData
          });
        } else {
          const created = await addAddress({
            ...pickupAddressData,
            ...pickupData
          });
          if (created?.addressId) {
            setSelectedPickupAddressId(normalizeId(created.addressId));
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

  return (
    <div className="checkout-shipment">
      <h2>{_('Delivery')}</h2>

      <div className="rounded-lg border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-lg font-medium">{_('Delivery method')}</div>
          </div>
        </div>

        <div className="mt-4 space-y-1 text-sm text-gray-700">
          {summaryLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="text-sm text-blue-600 underline"
            onClick={() => openPanel(deliveryType)}
          >
            {_('Change')}
          </button>
        </div>
      </div>

      {isPanelOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={closePanel} />
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
                  ? 'w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col'
                  : 'w-full h-full bg-white shadow-xl flex flex-col'
              }
            >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="text-lg font-medium">
                {_('Delivery method')}
              </div>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-800"
                onClick={closePanel}
              >
                x
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {panelStep === 'list' && (
                <div className="inline-flex items-center rounded-full border bg-gray-50 p-1 mb-6">
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
              )}
              {panelStep === 'list' ? (
                <div className="space-y-6">
                  {panelType === 'pickup' ? (
                    <div className="space-y-4">
                      {pickupAddresses.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                          {pickupAddresses.map((address) => {
                            const isSelected =
                              normalizeId(address.addressId) === selectedPickupAddressId;
                            return (
                              <div
                                key={address.uuid}
                                className={`border rounded p-4 ${
                                  isSelected ? 'border-gray-900' : 'border-gray-200'
                                }`}
                              >
                                <AddressSummary address={address} />
                                <div className="mt-3 flex gap-3">
                                  <button
                                    type="button"
                                    className="text-sm text-white bg-gray-900 px-3 py-1 rounded"
                                    onClick={() => handlePickupSelect(address)}
                                  >
                                    {_('Use')}
                                  </button>
                                  <button
                                    type="button"
                                    className="text-sm text-gray-600"
                                    onClick={async () => {
                                      try {
                                        await deleteAddress(address.addressId);
                                        toast.success(_('Recipient deleted'));
                                      } catch (error) {
                                        toast.error(
                                          error instanceof Error
                                            ? error.message
                                            : _('Failed to delete recipient')
                                        );
                                      }
                                    }}
                                  >
                                    {_('Delete')}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          {_('No pickup recipients yet')}
                        </div>
                      )}
                      <button
                        type="button"
                        className="text-sm text-blue-600"
                        onClick={() => setPanelStep('detail')}
                      >
                        + {_('Add pickup point')}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {courierAddresses.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                          {courierAddresses.map((address) => {
                            const isSelected =
                              normalizeId(address.addressId) === selectedCourierAddressId;
                            return (
                              <div
                                key={address.uuid}
                                className={`border rounded p-4 ${
                                  isSelected ? 'border-gray-900' : 'border-gray-200'
                                }`}
                              >
                                <AddressSummary address={address} />
                                <div className="mt-3 flex gap-3">
                                  <button
                                    type="button"
                                    className="text-sm text-white bg-gray-900 px-3 py-1 rounded"
                                    onClick={() => handleCourierSelect(address)}
                                  >
                                    {_('Use')}
                                  </button>
                                  <button
                                    type="button"
                                    className="text-sm text-gray-600"
                                    onClick={async () => {
                                      try {
                                        await deleteAddress(address.addressId);
                                        toast.success(_('Recipient deleted'));
                                      } catch (error) {
                                        toast.error(
                                          error instanceof Error
                                            ? error.message
                                            : _('Failed to delete recipient')
                                        );
                                      }
                                    }}
                                  >
                                    {_('Delete')}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          {_('No courier recipients yet')}
                        </div>
                      )}
                      <button
                        type="button"
                        className="text-sm text-blue-600"
                        onClick={() => setPanelStep('detail')}
                      >
                        + {_('Add address')}
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    className="w-full rounded-xl bg-gray-900 py-3 text-white text-sm font-medium"
                    onClick={async () => {
                      if (panelType === 'pickup' && selectedPickupAddress) {
                        await handlePickupSelect(selectedPickupAddress);
                        closePanel();
                        return;
                      }
                      if (panelType === 'courier' && selectedCourierAddress) {
                        await handleCourierSelect(selectedCourierAddress);
                        closePanel();
                        return;
                      }
                      setPanelStep('detail');
                    }}
                  >
                    {panelType === 'pickup'
                      ? _('Pick up here')
                      : _('Deliver here')}
                  </button>
                </div>
              ) : panelType === 'pickup' ? (
                <div className="space-y-6">
                  <button
                    type="button"
                    className="text-sm text-gray-500"
                    onClick={() => setPanelStep('list')}
                  >
                    {_('Back')}
                  </button>

                  <div>
                    <h3 className="text-base font-medium mb-3">
                      {_('Recipient')}
                    </h3>
                    <NameAndTelephone
                      fullName={shippingAddress?.fullName || ''}
                      telephone={shippingAddress?.telephone || ''}
                      getFieldName={(field) => `shippingAddress.${field}`}
                    />
                  </div>

                  <DeliveryMapPicker
                    onPointSelect={handlePointSelect}
                    selectedPointId={selectedPointId}
                    cartWeight={cartWeight}
                    cartLength={cartDimensions.length}
                    cartWidth={cartDimensions.width}
                    cartHeight={cartDimensions.height}
                    height="calc(100vh - 260px)"
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  <button
                    type="button"
                    className="text-sm text-gray-500"
                    onClick={() => setPanelStep('list')}
                  >
                    {_('Back')}
                  </button>

                  <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
                    <div className="space-y-6">
                      <CustomerAddressForm
                        areaId="checkoutShippingAddressForm"
                        fieldNamePrefix="shippingAddress"
                        address={shippingAddress}
                      />
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="px-4 py-2 border border-gray-300 rounded"
                          onClick={() => updateShipment(courierMethod)}
                          disabled={fetchingShippingMethods}
                        >
                          {_('Use this address')}
                        </button>
                        <button
                          type="button"
                          className="px-4 py-2 bg-gray-900 text-white rounded"
                          onClick={saveCourierRecipient}
                          disabled={fetchingShippingMethods}
                        >
                          {_('Save recipient')}
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
    </div>
  );
}
