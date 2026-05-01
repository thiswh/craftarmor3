import { Image } from '@components/common/Image.js';
import { ProductNoThumbnail } from '@components/common/ProductNoThumbnail.js';
import { Modal } from '@components/common/modal/Modal.js';
import { useCustomer } from '@components/frontStore/customer/CustomerContext.jsx';
import { _ } from '@evershop/evershop/lib/locale/translate/_';
import React from 'react';

const OrderDetail = ({ order }: { order: any }) => {
  return (
    <div className="order border-divider">
      <div className="order-inner grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="order-items col-span-2">
          {order.items.map((item: any) => (
            <div className="order-item mb-2 flex gap-5 items-center" key={item.productSku}>
              <div className="thumbnail border border-divider p-2 rounded">
                {item.thumbnail && (
                  <Image
                    width={100}
                    height={100}
                    style={{ maxWidth: '6rem' }}
                    src={item.thumbnail}
                    alt={item.productName}
                  />
                )}
                {!item.thumbnail && <ProductNoThumbnail width={100} height={100} />}
              </div>
              <div className="order-item-info">
                <div className="order-item-name font-semibold">{item.productName}</div>
                <div className="order-item-sku italic">
                  {_('Sku')}: #{item.productSku}
                </div>
                <div className="order-item-qty" style={{ fontSize: '0.9em' }}>
                  {item.qty} x {item.productPrice.text}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="order-total col-span-1">
          <div className="order-header">
            <div className="order-number">
              <span className="font-bold">
                {_('Order')}: #{order.orderNumber}
              </span>
              <span className="italic pl-2">{order.createdAt.text}</span>
            </div>
          </div>
          <div className="order-total-value font-bold">
            {_('Total')}:{order.grandTotal.text}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusLine = ({ text, badge }: { text: string; badge?: string }) => {
  let dot = 'bg-gray-500';
  let ring = 'ring-gray-300';
  if (badge === 'success') {
    dot = 'bg-green-500';
    ring = 'ring-green-300';
  }
  if (badge === 'critical') {
    dot = 'bg-red-500';
    ring = 'ring-red-300';
  }
  if (badge === 'warning') {
    dot = 'bg-amber-500';
    ring = 'ring-amber-300';
  }
  if (badge === 'interactive') {
    dot = 'bg-blue-500';
    ring = 'ring-blue-300';
  }
  return (
    <div className="flex items-center gap-3 font-semibold">
      <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full ring-4 ${ring}`}>
        <span className={`h-2 w-2 rounded-full ${dot}`} />
      </span>
      <span>{text}</span>
    </div>
  );
};

const OrderDetailsModal = ({ order }: { order: any }) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  return (
    <div className="space-y-4">
      <div className="rounded border border-gray-200 bg-white">
        <div className="p-4">
          <StatusLine
            text={order?.shipmentStatus?.name || _('Pending')}
            badge={order?.shipmentStatus?.badge}
          />
          <div className="mt-4 space-y-3">
            {items.map((item: any) => (
              <div
                key={String(item?.orderItemId || item?.uuid || item?.productSku)}
                className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-gray-100 pb-3 last:border-b-0"
              >
                <div className="min-w-0 flex items-start gap-3">
                  <div className="relative shrink-0 rounded border border-gray-200 p-1">
                    {item?.thumbnail ? (
                      <Image width={64} height={64} src={item.thumbnail} alt={item?.productName || ''} />
                    ) : (
                      <ProductNoThumbnail width={64} height={64} />
                    )}
                    <span className="absolute -right-2 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 px-1 text-xs">
                      {item?.qty || 0}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold">{item?.productName}</div>
                    <div className="text-sm text-gray-600">{`SKU: ${item?.productSku || ''}`}</div>
                    {Array.isArray(item?.variantOptions) &&
                      item.variantOptions.map((option: any) => (
                        <div
                          key={String(option?.optionId || option?.attributeCode)}
                          className="text-sm text-gray-600"
                        >
                          {option?.attributeName}: {option?.optionText}
                        </div>
                      ))}
                  </div>
                </div>
                <div className="whitespace-nowrap self-center text-sm">
                  {(item?.productPrice?.text || item?.finalPrice?.text || '0')} x {item?.qty || 0}
                </div>
                <div className="whitespace-nowrap self-center text-right font-semibold">
                  {item?.lineTotal?.text || item?.total?.text || '0'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white p-4">
        <StatusLine
          text={`${order?.paymentStatus?.name || _('Pending')} - ${
            order?.paymentMethodName || _('Unknown')
          }`}
          badge={order?.paymentStatus?.badge}
        />
        <div className="mt-4 space-y-1 text-sm">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-1">
            <span>{_('Subtotal')}</span>
            <span className="text-gray-600">{`${order?.totalQty || 0} ${_('items')}`}</span>
            <span>{order?.subTotal?.text || '0'}</span>
          </div>
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-1">
            <span>{_('Shipping')}</span>
            <span className="text-gray-600">{order?.shippingMethodName || ''}</span>
            <span>{order?.shippingFeeInclTax?.text || '0'}</span>
          </div>
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-1">
            <span>{_('Discount')}</span>
            <span />
            <span>{order?.discountAmount?.text || '0'}</span>
          </div>
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-gray-200 pt-2 font-bold">
            <span>{_('Total')}</span>
            <span />
            <span>{order?.grandTotal?.text || '0'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function OrderHistory({ title }: { title?: string }) {
  const { customer } = useCustomer();
  const orders = customer?.orders || [];
  const [selectedOrder, setSelectedOrder] = React.useState<any | null>(null);

  const openOrder = (order: any) => setSelectedOrder(order);
  const closeOrder = () => setSelectedOrder(null);

  return (
    <div className="order-history divide-y">
      {title && <h2 className="order-history-title">{title}</h2>}
      {orders.length === 0 && (
        <div className="order-history-empty">{_('You have not placed any orders yet')}</div>
      )}
      {orders.map((order: any) => (
        <div
          className="order-history-order border-divider py-5 cursor-pointer rounded transition-colors hover:bg-gray-50"
          key={order.orderId}
          role="button"
          tabIndex={0}
          onClick={() => openOrder(order)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openOrder(order);
            }
          }}
        >
          <OrderDetail order={order} key={order.orderId} />
        </div>
      ))}

      <Modal
        title={
          selectedOrder
            ? `${_('Order')} #${selectedOrder.orderNumber} - ${selectedOrder.createdAt?.text || ''}`
            : ''
        }
        onClose={closeOrder}
        isOpen={Boolean(selectedOrder)}
      >
        {selectedOrder ? <OrderDetailsModal order={selectedOrder} /> : null}
      </Modal>
    </div>
  );
}
