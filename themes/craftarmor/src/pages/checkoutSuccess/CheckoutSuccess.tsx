import Area from '@components/common/Area.js';
import React from 'react';
import './CheckoutSuccess.scss';

export default function CheckoutSuccessPage() {
  return (
    <div className="page-width checkout-success-page">
      <div className="checkout-success-page__content">
        <Area id="checkoutSuccessPageLeft" />
      </div>
    </div>
  );
}

export const layout = {
  areaId: 'content',
  sortOrder: 10
};

