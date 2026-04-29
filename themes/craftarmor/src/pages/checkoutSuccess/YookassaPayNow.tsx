import { _ } from '@evershop/evershop/lib/locale/translate/_';
import React from 'react';
import { toast } from 'react-toastify';

const TITLE_TEXT = 'Заказ создан';
const SUBTITLE_TEXT = 'Осталось оплатить заказ, и мы сразу начнем обработку.';
const PAID_TITLE_TEXT = 'Заказ успешно оплачен';
const PAID_SUBTITLE_TEXT = 'Мы уже начали обработку вашего заказа.';
const PAY_NOW_LABEL = 'Оплатить заказ';
const GO_TO_ORDER_LABEL = 'Перейти в заказ';
const CONTINUE_SHOPPING_LABEL = 'Продолжить покупки';
const REDIRECTING_TO_PAY_LABEL = 'Переходим к оплате...';

type Props = {
  order: {
    orderNumber?: string;
    uuid: string;
    grandTotal?: {
      text?: string;
    };
    paymentMethod?: string;
    paymentMethodName?: string;
    paymentStatus?: {
      code?: string;
      name?: string;
    };
  };
  accountUrl: string;
  homeUrl: string;
  createPaymentApi: string;
};

export default function YookassaPayNow({
  order,
  accountUrl,
  homeUrl,
  createPaymentApi
}: Props) {
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const resetLoading = () => setLoading(false);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resetLoading();
      }
    };

    window.addEventListener('pageshow', resetLoading);
    window.addEventListener('focus', resetLoading);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pageshow', resetLoading);
      window.removeEventListener('focus', resetLoading);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const paymentMethod = String(order?.paymentMethod || '').trim();
  const paymentStatusCode = String(order?.paymentStatus?.code || '').trim();
  const canPayNow =
    paymentMethod === 'yookassa_sbp' && paymentStatusCode === 'pending';
  const isPaid =
    paymentMethod === 'yookassa_sbp' && paymentStatusCode === 'paid';
  const orderTotalText = String(order?.grandTotal?.text || '').trim();
  const titleText = isPaid ? PAID_TITLE_TEXT : TITLE_TEXT;
  const subtitleText = isPaid ? PAID_SUBTITLE_TEXT : SUBTITLE_TEXT;

  const handlePrimaryClick = async () => {
    if (!canPayNow) {
      window.location.href = accountUrl || '/account';
      return;
    }
    if (loading) {
      return;
    }
    setLoading(true);

    try {
      const response = await fetch(createPaymentApi, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          order_id: order.uuid
        })
      });
      const payload = await response.json();

      if (!response.ok || payload?.error) {
        throw new Error(payload?.error?.message || _('Failed to create payment'));
      }

      const confirmationUrl = String(payload?.data?.confirmationUrl || '').trim();
      const redirectUrl = String(payload?.data?.redirectUrl || '').trim();

      if (confirmationUrl) {
        window.location.href = confirmationUrl;
        return;
      }
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }

      throw new Error(_('Payment URL is not available'));
    } catch (e: any) {
      setLoading(false);
      toast.error(e?.message || _('Unable to start payment'));
    }
  };

  return (
    <div className="checkout-success-hero">
      <div className="checkout-success-ozon-card rounded-2xl p-6 md:p-7">
        <div className="checkout-success-ozon-title-row mb-2">
          <div className="checkout-success-ozon-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="checkout-success-ozon-title">{titleText}</div>
        </div>
        <div className="checkout-success-ozon-subtitle mt-2 text-center text-sm md:text-base">
          {subtitleText}
        </div>
        {!isPaid ? (
          <>
            <div className="checkout-success-amount-wrap mt-4">
              <div className="checkout-success-amount-pill">
                <span className="checkout-success-amount-value">
                  {orderTotalText || '-'}
                </span>
              </div>
            </div>
          </>
        ) : null}

        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={handlePrimaryClick}
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-lg bg-gray-900 px-6 py-4 text-lg font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? REDIRECTING_TO_PAY_LABEL
              : canPayNow
                ? PAY_NOW_LABEL
                : GO_TO_ORDER_LABEL}
          </button>
          <a
            href={homeUrl || '/'}
            className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50"
          >
            {CONTINUE_SHOPPING_LABEL}
          </a>
        </div>
      </div>
    </div>
  );
}

export const layout = {
  areaId: 'checkoutSuccessPageLeft',
  sortOrder: 5
};

export const query = `
  query Query {
    order(uuid: getContextValue("orderId")) {
      orderNumber
      uuid
      grandTotal {
        text
      }
      paymentMethod
      paymentMethodName
      paymentStatus {
        code
        name
      }
    }
    accountUrl: url(routeId: "account")
    homeUrl: url(routeId: "homepage")
    createPaymentApi: url(routeId: "yookassaCreatePayment")
  }
`;
