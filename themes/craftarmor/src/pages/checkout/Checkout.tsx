import Area from '@components/common/Area.js';
import { Form } from '@components/common/form/Form.js';
import { CartItems } from '@components/frontStore/cart/CartItems.js';
import { CartSummaryItemsList } from '@components/frontStore/cart/CartSummaryItems.js';
import { CartTotalSummary } from '@components/frontStore/cart/CartTotalSummary.js';
import { useCartState } from '@components/frontStore/cart/CartContext.js';
import { CheckoutButton } from '@components/frontStore/checkout/CheckoutButton.js';
import { CheckoutProvider } from '@components/frontStore/checkout/CheckoutContext.js';
import { ContactInformation } from '@components/frontStore/checkout/ContactInformation.js';
import { Payment } from '@components/frontStore/checkout/Payment.js';
import { Shipment } from '@components/frontStore/checkout/Shipment.js';
import { useCustomer } from '@components/frontStore/customer/CustomerContext.jsx';
import { _ } from '@evershop/evershop/lib/locale/translate/_';
import React from 'react';
import { useForm } from 'react-hook-form';
import './Checkout.scss';

interface CheckoutPageProps {
  placeOrderApi: string;
  getPaymentMethodApi: string;
  getShippingMethodApi: string;
  checkoutSuccessUrl: string;
}

function CheckoutContent() {
  const { customer } = useCustomer();
  const isLoggedIn = Boolean(customer);
  const { data: cart } = useCartState();
  const hasDelivery = Boolean(cart?.shippingMethod && cart?.shippingAddress);

  return (
    <>
      <ContactInformation />
      {isLoggedIn ? (
        <>
          <Shipment />
          <Payment />
          {hasDelivery ? <CheckoutButton /> : null}
        </>
      ) : (
        <div className="mt-6 rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          {_('Please log in to continue checkout.')}
        </div>
      )}
    </>
  );
}

export default function CheckoutPage({
  placeOrderApi,
  checkoutSuccessUrl
}: CheckoutPageProps) {
  const [disabled, setDisabled] = React.useState(false);
  const form = useForm({
    disabled: disabled,
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: {}
  });

  return (
    <CheckoutProvider
      form={form}
      enableForm={() => setDisabled(false)}
      disableForm={() => setDisabled(true)}
      allowGuestCheckout={false}
      placeOrderApi={placeOrderApi}
      checkoutSuccessUrl={checkoutSuccessUrl}
    >
      <div className="page-width grid grid-cols-1 md:grid-cols-2 gap-7 pt-8 pb-8">
        <Form form={form} submitBtn={false}>
          <div>
            <CheckoutContent />
          </div>
          <Area id="checkoutForm" noOuter />
        </Form>
        <div>
          <CartItems>
            {({ items, loading, showPriceIncludingTax }) => (
              <CartSummaryItemsList
                items={items}
                loading={loading}
                showPriceIncludingTax={showPriceIncludingTax}
              />
            )}
          </CartItems>
          <CartTotalSummary />
        </div>
      </div>
    </CheckoutProvider>
  );
}

export const layout = {
  areaId: 'content',
  sortOrder: 10
};

export const query = `
  query Query {
    placeOrderApi: url(routeId: "createOrder")
    checkoutSuccessUrl: url(routeId: "checkoutSuccess")
  }
`;
