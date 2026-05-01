import { useCartState } from '@components/frontStore/cart/CartContext.js';
import { DefaultMiniCartIcon } from '@components/frontStore/cart/DefaultMiniCartIcon.js';
import React, { useCallback } from 'react';

interface MiniCartProps {
  cartUrl?: string;
  dropdownPosition?: 'left' | 'right';
  showItemCount?: boolean;
  CartIconComponent?: React.FC<{
    totalQty: number;
    onClick: () => void;
    isOpen: boolean;
    disabled?: boolean;
    showItemCount?: boolean;
    syncStatus: {
      syncing: boolean;
    };
  }>;
  className?: string;
  disabled?: boolean;
}

export function MiniCart({
  cartUrl = '/cart',
  showItemCount = true,
  CartIconComponent,
  className = '',
  disabled = false
}: MiniCartProps) {
  const { data: cartData, syncStatus } = useCartState();
  const cart = cartData;

  const handleCartClick = useCallback(() => {
    if (disabled) {
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.href = cartUrl;
    }
  }, [cartUrl, disabled]);

  return (
    <div className={`mini__cart__wrapper relative ${className}`}>
      {CartIconComponent ? (
        <CartIconComponent
          totalQty={cart?.totalQty || 0}
          onClick={handleCartClick}
          isOpen={false}
          disabled={disabled}
          showItemCount={showItemCount}
          syncStatus={syncStatus}
        />
      ) : (
        <DefaultMiniCartIcon
          totalQty={cart?.totalQty || 0}
          onClick={handleCartClick}
          isOpen={false}
          disabled={disabled}
          showItemCount={showItemCount}
          syncStatus={syncStatus}
        />
      )}
    </div>
  );
}
