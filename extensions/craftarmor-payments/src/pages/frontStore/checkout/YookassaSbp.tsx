import {
  useCheckout,
  useCheckoutDispatch
} from '@components/frontStore/checkout/CheckoutContext.js';
import { _ } from '@evershop/evershop/lib/locale/translate/_';
import React, { useEffect } from 'react';

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
  setting
}: {
  setting: { yookassaSbpDisplayName: string };
}) {
  const {
    checkoutSuccessUrl,
    orderPlaced,
    orderId,
    checkoutData: { paymentMethod }
  } = useCheckout() as any;
  const { registerPaymentComponent } = useCheckoutDispatch();

  useEffect(() => {
    if (!orderPlaced || !orderId || paymentMethod !== 'yookassa_sbp') {
      return;
    }

    // For YooKassa we now place order first and continue payment on success page.
    window.location.href = `${checkoutSuccessUrl}/${orderId}`;
  }, [checkoutSuccessUrl, orderId, orderPlaced, paymentMethod]);

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
              'Place the order first. You can complete payment on the next step.'
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
                ? _('Placing order...')
                : orderPlaced
                  ? _('Redirecting...')
                  : _('Place order')}
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
  }
`;
