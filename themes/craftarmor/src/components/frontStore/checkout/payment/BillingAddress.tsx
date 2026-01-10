import {
  useCheckout,
  useCheckoutDispatch
} from '@components/frontStore/checkout/CheckoutContext.js';
import { CustomerAddressGraphql } from '@evershop/evershop/types/customerAddress';
import React, { useEffect, useRef } from 'react';
import { useWatch } from 'react-hook-form';

const getAddressSyncKey = (address?: Record<string, any>) => {
  if (!address) {
    return '';
  }
  const province = address.province?.code || address.province || '';
  const country = address.country?.code || address.country || '';
  return [
    address.full_name || address.fullName || '',
    address.telephone || '',
    address.address_1 || address.address1 || '',
    address.address_2 || address.address2 || '',
    address.city || '',
    province,
    country,
    address.postcode || ''
  ].join('|');
};

export function BillingAddress({
  billingAddress
}: {
  billingAddress?: CustomerAddressGraphql;
}) {
  const { form } = useCheckout();
  const { updateCheckoutData } = useCheckoutDispatch();
  const shippingAddress = useWatch({
    control: form.control,
    name: 'shippingAddress'
  });
  const lastSyncedRef = useRef('');

  useEffect(() => {
    if (!shippingAddress) {
      if (lastSyncedRef.current) {
        updateCheckoutData({ billingAddress: undefined });
        lastSyncedRef.current = '';
      }
      return;
    }

    const key = getAddressSyncKey(shippingAddress);
    if (!key || lastSyncedRef.current === key) {
      return;
    }

    updateCheckoutData({ billingAddress: shippingAddress });
    lastSyncedRef.current = key;
  }, [shippingAddress, updateCheckoutData]);

  useEffect(() => {
    if (!shippingAddress && billingAddress && !lastSyncedRef.current) {
      updateCheckoutData({ billingAddress });
      lastSyncedRef.current = getAddressSyncKey(billingAddress as any);
    }
  }, [billingAddress, shippingAddress, updateCheckoutData]);

  return null;
}
