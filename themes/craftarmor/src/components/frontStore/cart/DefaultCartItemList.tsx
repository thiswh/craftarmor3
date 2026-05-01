import { Area } from '@components/common/Area.js';
import { ExtendableTable } from '@components/common/ExtendableTable.js';
import { Image } from '@components/common/Image.js';
import { ProductNoThumbnail } from '@components/common/ProductNoThumbnail.js';
import {
  useCartDispatch,
  useCartState,
  CartSyncTrigger
} from '@components/frontStore/cart/CartContext.js';
import { ItemQuantity } from '@components/frontStore/cart/ItemQuantity.js';
import { _ } from '@evershop/evershop/lib/locale/translate/_';
import React from 'react';
import { toast } from 'react-toastify';

const toErrorMessage = (errorPayload: any, fallback: string) => {
  const message = String(errorPayload?.error?.message || '').trim();
  return message || fallback;
};

export const DefaultCartItemList = ({
  items,
  showPriceIncludingTax = true,
  loading = false,
  onSort,
  currentSort,
  onRemoveItem,
  allSelected = false,
  selectionBusy = false,
  onToggleAll
}: {
  items: any[];
  showPriceIncludingTax?: boolean;
  loading?: boolean;
  onSort?: (...args: any[]) => void;
  currentSort?: any;
  onRemoveItem?: (cartItemId: number) => void;
  allSelected?: boolean;
  selectionBusy?: boolean;
  onToggleAll?: (selected: boolean) => void;
}) => {
  const { data: cart } = useCartState();
  const { syncCartWithServer } = useCartDispatch();
  const [selectionLoading, setSelectionLoading] = React.useState<
    Record<string, boolean>
  >({});

  const selectionApi = cart?.uuid ? `/api/carts/${cart.uuid}/selection` : '';

  const updateSelection = React.useCallback(
    async (itemUuid: string, selected: boolean) => {
      if (!selectionApi || !itemUuid) {
        return;
      }
      setSelectionLoading((prev) => ({ ...prev, [itemUuid]: true }));
      try {
        const response = await fetch(selectionApi, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_id: itemUuid,
            selected
          })
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(
            toErrorMessage(payload, _('Failed to update item selection'))
          );
        }
        await syncCartWithServer(CartSyncTrigger.UPDATE_ITEM);
      } catch (e: any) {
        toast.error(e?.message || _('Failed to update item selection'));
      } finally {
        setSelectionLoading((prev) => ({ ...prev, [itemUuid]: false }));
      }
    },
    [selectionApi, syncCartWithServer]
  );

  const columns = [
    {
      key: 'selection',
      header: {
        label: (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={allSelected}
              disabled={selectionBusy || loading}
              onChange={(e) => onToggleAll?.(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-gray-500 accent-black focus:ring-2 focus:ring-black/20"
              aria-label={_('Select all items')}
            />
          </div>
        ),
        className: 'w-[48px]'
      },
      className: 'align-top w-[48px]',
      sortable: false,
      render: (row: any) => {
        const uuid = String(row.uuid || '');
        const checked = row.isSelected !== false;
        const isBusy = Boolean(selectionLoading[uuid]);
        return (
          <div className="pt-2">
            <input
              type="checkbox"
              checked={checked}
              disabled={loading || isBusy}
              onChange={(e) => updateSelection(uuid, e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-gray-500 accent-black focus:ring-2 focus:ring-black/20"
              aria-label={_('Select item')}
            />
          </div>
        );
      }
    },
    {
      key: 'productInfo',
      header: { label: _('Product'), className: '' },
      className: 'font-medium align-top',
      sortable: false,
      render: (row: any) => {
        const priceValue = showPriceIncludingTax
          ? row.productPriceInclTax?.text
          : row.productPrice?.text;

        return (
          <div className="flex justify-start gap-4">
            <div>
              {row.thumbnail ? (
                <Image
                  src={row.thumbnail}
                  alt={row.productName}
                  width={80}
                  height={80}
                  className="rounded-md"
                />
              ) : (
                <ProductNoThumbnail width={80} height={80} />
              )}
            </div>
            <div className="font-medium flex flex-col gap-1 items-start h-full">
              <span className="font-semibold">{row.productName}</span>
              {row.variantOptions?.map((option: any) => (
                <span key={option.optionId} className="text-xs text-muted">
                  {option.attributeName}: {option.optionText}
                </span>
              ))}
              <span className="text-sm text-muted">
                {priceValue} x {row.qty}
              </span>
              <a
                href="#"
                className="text-red-500 text-sm"
                onClick={(e) => {
                  e.preventDefault();
                  onRemoveItem?.(row.cartItemId);
                }}
              >
                {_('Remove')}
              </a>
              {row.errors?.map((errorText: string, index: number) => (
                <span key={index} className="text-xs text-red-500">
                  {errorText}
                </span>
              ))}
            </div>
          </div>
        );
      }
    },
    {
      key: 'qty',
      header: { label: _('Quantity'), className: 'text-center' },
      sortable: true,
      render: (row: any) => {
        return (
          <div className="text-left">
            <ItemQuantity
              initialValue={row.qty}
              cartItemId={row.cartItemId}
              min={1}
              max={99}
            >
              {({ quantity, increase, decrease }) => (
                <div className="flex items-center">
                  <button
                    onClick={decrease}
                    disabled={loading || quantity <= 1}
                    className="px-1 disabled:opacity-50 text-lg"
                  >
                    −
                  </button>
                  <span className="min-w-[3rem] text-center">{quantity}</span>
                  <button
                    onClick={increase}
                    disabled={loading}
                    className="disabled:opacity-50 text-lg"
                  >
                    +
                  </button>
                </div>
              )}
            </ItemQuantity>
          </div>
        );
      }
    },
    {
      key: 'lineTotal',
      header: { label: _('Total'), className: 'flex justify-end' },
      sortable: true,
      render: (row: any) => {
        const totalValue = showPriceIncludingTax
          ? row.lineTotalInclTax?.text
          : row.lineTotal?.text;

        return (
          <div className="text-right">
            <span className="font-bold">{totalValue}</span>
          </div>
        );
      }
    }
  ];

  const [rows, setRows] = React.useState(items);

  React.useEffect(() => {
    setRows(items);
  }, [items]);

  return (
    <>
      <Area id="miniCartItemListBefore" noOuter />
      <ExtendableTable
        name="shoppingCartItems"
        columns={columns}
        initialData={rows}
        loading={loading}
        emptyMessage={_('Your cart is empty')}
        onSort={onSort}
        currentSort={currentSort}
        className="cart__items__table border-none table-auto border-spacing-y-2 border-separate w-full"
      />
      <Area id="miniCartItemListAfter" noOuter />
      <style>{`
        .cart__items__table th, .cart__items__table td {
          padding: 0.75rem;
        }
        .cart__items__table th {
          border: none;
        }
        .cart__items__table td {
          border: none;
        }
      `}</style>
    </>
  );
};
