import Area from '@components/common/Area.js';
import Button from '@components/common/Button.js';
import { useCartDispatch, useCartState, CartSyncTrigger } from '@components/frontStore/cart/CartContext.js';
import { CartItems } from '@components/frontStore/cart/CartItems.js';
import { DefaultCartItemList } from '@components/frontStore/cart/DefaultCartItemList.js';
import { ShoppingCartEmpty } from '@components/frontStore/cart/ShoppingCartEmpty.js';
import { _ } from '@evershop/evershop/lib/locale/translate/_';
import React from 'react';
import { toast } from 'react-toastify';

const Title = ({ title }: { title: string }) => {
  return (
    <div className="mb-7 text-center shopping-cart-header">
      <h1 className="shopping-cart-title mb-2">{title}</h1>
      <a href="/" className="underline">
        {_('Continue Shopping')}
      </a>
    </div>
  );
};

const toMessage = (payload: any, fallback: string) => {
  const message = String(payload?.error?.message || '').trim();
  return message || fallback;
};

export default function ShoppingCart({ checkoutUrl }: { checkoutUrl: string }) {
  const { data: cart } = useCartState();
  const { syncCartWithServer } = useCartDispatch();
  const items = Array.isArray(cart?.items) ? cart.items : [];
  const selectedItems = items.filter((item: any) => item.isSelected !== false);
  const selectedCount = items.filter((item: any) => item.isSelected !== false).length;
  const selectedSubtotalValue = selectedItems.reduce((sum: number, item: any) => {
    const lineTotal = Number(item?.lineTotal?.value ?? 0);
    return sum + (Number.isFinite(lineTotal) ? lineTotal : 0);
  }, 0);
  const formattedSelectedSubtotal = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: String(cart?.currency || 'RUB'),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(selectedSubtotalValue);
  const hasItems = items.length > 0;
  const allSelected = hasItems && selectedCount === items.length;
  const [selectionBusy, setSelectionBusy] = React.useState(false);

  const selectionApi = cart?.uuid ? `/api/carts/${cart.uuid}/selection` : '';

  const updateAllSelection = React.useCallback(
    async (selected: boolean) => {
      if (!selectionApi) {
        return;
      }
      setSelectionBusy(true);
      try {
        const response = await fetch(selectionApi, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            select_all: true,
            selected
          })
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(toMessage(payload, _('Failed to update selection')));
        }
        await syncCartWithServer(CartSyncTrigger.UPDATE_ITEM);
      } catch (e: any) {
        toast.error(e?.message || _('Failed to update selection'));
      } finally {
        setSelectionBusy(false);
      }
    },
    [selectionApi, syncCartWithServer]
  );

  return (
    <div className="cart page-width">
      {hasItems ? (
        <>
          <Title title={_('Shopping Cart')} />
          <div className="grid gap-10 grid-cols-1 md:grid-cols-4">
            <div className="col-span-1 md:col-span-3">
              <Area id="shoppingCartBeforeItems" noOuter />

              <CartItems>
                {({ items: listItems, showPriceIncludingTax, loading, onRemoveItem }) => (
                  <DefaultCartItemList
                    items={listItems}
                    showPriceIncludingTax={showPriceIncludingTax}
                    loading={loading}
                    onRemoveItem={onRemoveItem}
                    allSelected={allSelected}
                    selectionBusy={selectionBusy}
                    onToggleAll={updateAllSelection}
                  />
                )}
              </CartItems>
              <Area id="shoppingCartAfterItems" noOuter />
            </div>
            <div className="col-span-1 md:col-span-1">
              <Area id="shoppingCartBeforeSummary" noOuter />
              <div className="grid grid-cols-1 gap-5 cart-summary">
                <h4>{_('Order summary')}</h4>
                <div className="cart__total__summary font-semibold">
                  <div className="summary-row flex justify-between gap-7 py-2">
                    <span>{_('Products (${count})', { count: String(selectedCount) })}</span>
                    <span>{formattedSelectedSubtotal}</span>
                  </div>
                  <div className="summary__row grand-total flex justify-between py-2">
                    <span className="self-center font-bold">{_('Total')}</span>
                    <span className="font-bold">{formattedSelectedSubtotal}</span>
                  </div>
                </div>
              </div>
              <Area id="shoppingCartBeforeCheckoutButton" noOuter />
              <div className="shopping-cart-checkout-btn flex justify-between mt-5">
                <Button
                  url={selectedCount > 0 ? checkoutUrl : '#'}
                  title={_('CHECKOUT')}
                  variant="primary"
                  disabled={selectedCount === 0}
                />
              </div>
              {selectedCount === 0 ? (
                <div className="mt-2 text-xs text-red-600">
                  {_('Select at least one item to proceed to checkout')}
                </div>
              ) : null}
              <Area id="shoppingCartAfterSummary" noOuter />
            </div>
          </div>
        </>
      ) : (
        <ShoppingCartEmpty />
      )}
    </div>
  );
}

export const layout = {
  areaId: 'content',
  sortOrder: 10
};

export const query = `
  query Query {
    checkoutUrl: url(routeId: "checkout")
  }
`;
