import React, { useEffect, useRef, useState } from 'react';
import { useCartState } from '@components/frontStore/cart/CartContext.js';
import { _ } from '@evershop/evershop/lib/locale/translate/_';
import { toast } from 'react-toastify';

export function OrderComment() {
  const { data: cart } = useCartState();
  const [shippingNoteDraft, setShippingNoteDraft] = useState('');
  const [shippingNoteSaving, setShippingNoteSaving] = useState(false);
  const [shippingNoteDirty, setShippingNoteDirty] = useState(false);
  const shippingNoteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shippingNoteInitRef = useRef<string | null>(null);
  const shippingNoteSavingRef = useRef(false);

  useEffect(() => {
    if (!cart?.uuid) {
      return;
    }
    if (shippingNoteInitRef.current === cart.uuid) {
      return;
    }
    shippingNoteInitRef.current = cart.uuid;
    setShippingNoteDraft(cart.shippingNote || '');
    setShippingNoteDirty(false);
  }, [cart?.shippingNote, cart?.uuid]);

  useEffect(() => {
    if (!cart?.addNoteApi) {
      return;
    }
    if (!shippingNoteDirty) {
      return;
    }
    if (shippingNoteSavingRef.current) {
      return;
    }
    const currentNote = cart?.shippingNote || '';
    if (shippingNoteDraft === currentNote) {
      if (shippingNoteDirty) {
        setShippingNoteDirty(false);
      }
      return;
    }
    if (shippingNoteTimeoutRef.current) {
      clearTimeout(shippingNoteTimeoutRef.current);
    }
    shippingNoteTimeoutRef.current = setTimeout(async () => {
      shippingNoteSavingRef.current = true;
      setShippingNoteSaving(true);
      try {
        const response = await fetch(cart.addNoteApi, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: shippingNoteDraft })
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok || json?.error) {
          throw new Error(
            json?.error?.message || _('Failed to set shipping note')
          );
        }
        setShippingNoteDirty(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : _('Failed to set shipping note')
        );
      } finally {
        shippingNoteSavingRef.current = false;
        setShippingNoteSaving(false);
      }
    }, 600);
    return () => {
      if (shippingNoteTimeoutRef.current) {
        clearTimeout(shippingNoteTimeoutRef.current);
      }
    };
  }, [cart?.addNoteApi, cart?.shippingNote, shippingNoteDraft, shippingNoteDirty]);

  return (
    <div className="checkout-comment">
      <h3>{_('Order comment')}</h3>
      <div>
        <textarea
          value={shippingNoteDraft}
          onChange={(event) => {
            setShippingNoteDraft(event.target.value);
            if (!shippingNoteDirty) {
              setShippingNoteDirty(true);
            }
          }}
          placeholder={_('Add a comment for the order')}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none mb-0"
          rows={3}
        />
      </div>
      {shippingNoteSaving ? (
        <div className="mt-2 text-xs text-gray-500">
          {_('Saving...')}
        </div>
      ) : null}
    </div>
  );
}
