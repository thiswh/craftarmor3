import {
  useCheckout,
  useCheckoutDispatch
} from '@components/frontStore/checkout/CheckoutContext.js';
import { _ } from '@evershop/evershop/lib/locale/translate/_';
import React, { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';

function SbpLogo({ width = 64 }: { width?: number }) {
  return (
    <img
      src="/images/sbp.svg"
      alt="SBP"
      width={width}
      className="h-auto"
      loading="lazy"
    />
  );
}

export default function YookassaSbpMethod({
  setting,
  createPaymentApi
}: {
  setting: { yookassaSbpDisplayName: string };
  createPaymentApi: string;
}) {
  const createRequestStartedRef = useRef(false);
  const {
    checkoutSuccessUrl,
    orderPlaced,
    orderId,
    checkoutData: { paymentMethod }
  } = useCheckout() as any;
  const { registerPaymentComponent } = useCheckoutDispatch();

  useEffect(() => {
    const createPayment = async () => {
      const response = await fetch(createPaymentApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId })
      });
      const payload = await response.json();
      if (!response.ok || payload?.error) {
        throw new Error(
          payload?.error?.message || _('Failed to create YooKassa payment')
        );
      }
      return payload?.data || {};
    };

    const redirectToPayment = async () => {
      try {
        const data = await createPayment();
        if (data.confirmationUrl) {
          window.location.href = data.confirmationUrl;
          return;
        }
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
          return;
        }
        window.location.href = `${checkoutSuccessUrl}/${orderId}`;
      } catch (e: any) {
        createRequestStartedRef.current = false;
        toast.error(e?.message || _('Unable to start payment'));
      }
    };

    if (!orderPlaced || !orderId || paymentMethod !== 'yookassa_sbp') {
      return;
    }
    if (createRequestStartedRef.current) {
      return;
    }
    createRequestStartedRef.current = true;
    redirectToPayment();
  }, [createPaymentApi, checkoutSuccessUrl, orderId, orderPlaced, paymentMethod]);

  useEffect(() => {
    registerPaymentComponent('yookassa_sbp', {
      nameRenderer: () => (
        <div className="flex items-center justify-between">
          <span>{setting.yookassaSbpDisplayName || 'SBP (YooKassa)'}</span>
          <SbpLogo />
        </div>
      ),
      formRenderer: () => (
        <div className="flex justify-center text-gray-500">
          <div className="w-2/3 text-center p-4">
            {_(
              'After clicking the button, you will be redirected to YooKassa to complete SBP payment.'
            )}
          </div>
        </div>
      ),
      checkoutButtonRenderer: () => {
        const { checkout } = useCheckoutDispatch();
        const { loadingStates, orderPlaced } = useCheckout() as any;
        const isDisabled = loadingStates.placingOrder || orderPlaced;

        const handleClick = async (e) => {
          e.preventDefault();
          await checkout();
        };

        return (
          <button
            type="button"
            onClick={handleClick}
            disabled={isDisabled}
            className="w-full bg-gray-900 text-white py-4 px-6 rounded-lg font-semibold text-lg shadow hover:bg-black focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center justify-center gap-2">
              {loadingStates.placingOrder
                ? _('Creating payment...')
                : orderPlaced
                  ? _('Redirecting to payment...')
                  : _('Pay via SBP')}
            </span>
          </button>
        );
      }
    });
  }, [registerPaymentComponent, setting.yookassaSbpDisplayName]);

  return null;
}

export const layout = {
  areaId: 'checkoutForm',
  sortOrder: 11
};

export const query = `
  query Query {
    setting {
      yookassaSbpDisplayName
    }
    createPaymentApi: url(routeId: "yookassaCreatePayment")
  }
`;

