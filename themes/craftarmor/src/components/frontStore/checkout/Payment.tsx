import { useCartState } from '@components/frontStore/cart/CartContext.js';
import {
  useCheckout,
  useCheckoutDispatch
} from '@components/frontStore/checkout/CheckoutContext.js';
import { PaymentMethods } from '@components/frontStore/checkout/payment/PaymentMethods.js';
import { _ } from '@evershop/evershop/lib/locale/translate/_';
import React, { useEffect } from 'react';
import { useWatch } from 'react-hook-form';

export function Payment() {
  const { data: cart, loadingStates } = useCartState();
  const { updateCheckoutData } = useCheckoutDispatch();
  const { form, checkoutData } = useCheckout() as any;
  const paymentMethod = useWatch({
    name: 'paymentMethod',
    control: form.control
  });

  const availablePaymentMethods = Array.isArray(cart?.availablePaymentMethods)
    ? cart.availablePaymentMethods
    : [];
  const singlePaymentMethod =
    availablePaymentMethods.length === 1 ? availablePaymentMethods[0] : null;
  const isSingleSbpMethod = singlePaymentMethod?.code === 'yookassa_sbp';
  const addingBillingAddress = loadingStates?.addingBillingAddress;
  const hasDelivery = Boolean(cart?.shippingMethod && cart?.shippingAddress);
  const hasInvalidItems = Boolean(checkoutData?.hasInvalidItems);
  const canShowPayment = hasDelivery && !hasInvalidItems;

  useEffect(() => {
    if (!paymentMethod || availablePaymentMethods.length === 0) {
      return;
    }
    const methodDetails = availablePaymentMethods.find(
      (method) => method.code === paymentMethod
    );
    if (methodDetails) {
      updateCheckoutData({ paymentMethod: methodDetails.code });
    }
  }, [paymentMethod, availablePaymentMethods, form, updateCheckoutData]);

  useEffect(() => {
    if (!singlePaymentMethod || !canShowPayment) {
      return;
    }

    const selected = form.getValues('paymentMethod');
    if (selected !== singlePaymentMethod.code) {
      form.setValue('paymentMethod', singlePaymentMethod.code, {
        shouldDirty: false
      });
    }
    if (checkoutData?.paymentMethod !== singlePaymentMethod.code) {
      updateCheckoutData({ paymentMethod: singlePaymentMethod.code });
    }
  }, [
    canShowPayment,
    checkoutData?.paymentMethod,
    form,
    singlePaymentMethod,
    updateCheckoutData
  ]);

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
        {singlePaymentMethod ? (
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-3">
            <div className="text-xs text-gray-500">{_('Payment method')}</div>
            <div className="mt-1 flex items-center gap-2 text-sm font-medium text-gray-900">
              {isSingleSbpMethod ? (
                <img
                  src="/images/sbp.svg"
                  alt="SBP"
                  className="h-5 w-auto"
                  loading="lazy"
                />
              ) : null}
              <span>{_(singlePaymentMethod.name)}</span>
            </div>
          </div>
        ) : (
          <PaymentMethods
            methods={availablePaymentMethods.map((method) => ({ ...method }))}
            isLoading={addingBillingAddress}
          />
        )}
      </div>
    </div>
  );
}
