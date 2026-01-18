import { useCartState } from '@components/frontStore/cart/CartContext.js';
import {
  useCheckout,
  useCheckoutDispatch
} from '@components/frontStore/checkout/CheckoutContext.js';
import { BillingAddress } from '@components/frontStore/checkout/payment/BillingAddress.js';
import { PaymentMethods } from '@components/frontStore/checkout/payment/PaymentMethods.js';
import { _ } from '@evershop/evershop/lib/locale/translate/_';
import React, { useEffect } from 'react';
import { useWatch } from 'react-hook-form';
import { toast } from 'react-toastify';

export function Payment() {
  const { data: cart, loadingStates } = useCartState();
  const { updateCheckoutData } = useCheckoutDispatch();
  const { form, checkoutData } = useCheckout() as any;
  const paymentMethod = useWatch({
    name: 'paymentMethod',
    control: form.control
  });

  const availablePaymentMethods = cart?.availablePaymentMethods;
  const billingAddress = cart?.billingAddress;
  const addingBillingAddress = loadingStates?.addingBillingAddress;
  const hasDelivery = Boolean(cart?.shippingMethod && cart?.shippingAddress);
  const hasInvalidItems = Boolean(checkoutData?.hasInvalidItems);
  const canShowPayment = hasDelivery && !hasInvalidItems;

  useEffect(() => {
    const updatePaymentMethod = async () => {
      try {
        const selected = form.getValues('paymentMethod');
        const methodDetails = availablePaymentMethods?.find(
          (method) => method.code === selected
        );
        if (!methodDetails) {
          throw new Error('Please select a valid payment method');
        }
        updateCheckoutData({ paymentMethod: methodDetails.code });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : _('Failed to update shipment')
        );
      }
    };
    if (paymentMethod) {
      updatePaymentMethod();
    }
  }, [paymentMethod, availablePaymentMethods, form, updateCheckoutData]);

  return (
    <div className="checkout-shipment">
      <h3>{_('Payment')}</h3>
      {!hasDelivery ? (
        <div className="mt-1 mb-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          {_(
            'Select delivery address - after that we will show available payment methods.'
          )}
        </div>
      ) : null}
      {hasInvalidItems ? (
        <div className="mt-1 mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {_(
            'Remove unavailable items to see available payment methods.'
          )}
        </div>
      ) : null}
      <div className={canShowPayment ? '' : 'pointer-events-none opacity-60'}>
        <PaymentMethods
          methods={availablePaymentMethods?.map((method) => ({ ...method }))}
          isLoading={addingBillingAddress}
        />
        <BillingAddress billingAddress={billingAddress} />
      </div>
    </div>
  );
}
