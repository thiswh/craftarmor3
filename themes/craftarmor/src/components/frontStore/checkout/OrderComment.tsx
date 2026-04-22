import React, { useEffect, useRef, useState } from 'react';
import { useCartState } from '@components/frontStore/cart/CartContext.js';
import { _ } from '@evershop/evershop/lib/locale/translate/_';
import { toast } from 'react-toastify';

declare global {
  interface Window {
    __checkoutFlushOrderComment?: () => Promise<boolean>;
  }
}

export function OrderComment() {
  const { data: cart } = useCartState();
  const [shippingNoteDraft, setShippingNoteDraft] = useState('');
  const [shippingNoteSaving, setShippingNoteSaving] = useState(false);
  const [shippingNoteDirty, setShippingNoteDirty] = useState(false);
  const shippingNoteInitRef = useRef<string | null>(null);
  const shippingNoteSavingPromiseRef = useRef<Promise<boolean> | null>(null);
  const shippingNoteLastSavedRef = useRef('');
  const shippingNoteDraftRef = useRef('');

  useEffect(() => {
    if (!cart?.uuid) {
      return;
    }
    if (shippingNoteInitRef.current === cart.uuid) {
      return;
    }
    shippingNoteInitRef.current = cart.uuid;
    const initialNote = cart.shippingNote || '';
    shippingNoteLastSavedRef.current = initialNote;
    shippingNoteDraftRef.current = initialNote;
    setShippingNoteDraft(initialNote);
    setShippingNoteDirty(false);
  }, [cart?.shippingNote, cart?.uuid]);

  useEffect(() => {
    shippingNoteDraftRef.current = shippingNoteDraft;
  }, [shippingNoteDraft]);

  const saveShippingNoteIfNeeded = async (): Promise<boolean> => {
    if (!cart?.addNoteApi) {
      return true;
    }
    if (shippingNoteSavingPromiseRef.current) {
      return shippingNoteSavingPromiseRef.current;
    }

    const runSave = async (): Promise<boolean> => {
      while (true) {
        const currentDraft = shippingNoteDraftRef.current;
        if (currentDraft === shippingNoteLastSavedRef.current) {
          setShippingNoteDirty(false);
          return true;
        }

        setShippingNoteSaving(true);
        try {
          const response = await fetch(cart.addNoteApi, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: currentDraft })
          });
          const json = await response.json().catch(() => ({}));
          if (!response.ok || json?.error) {
            throw new Error(
              json?.error?.message || _('Failed to set shipping note')
            );
          }
          shippingNoteLastSavedRef.current = currentDraft;

          if (shippingNoteDraftRef.current === currentDraft) {
            setShippingNoteDirty(false);
            return true;
          }
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : _('Failed to set shipping note')
          );
          return false;
        } finally {
          setShippingNoteSaving(false);
        }
      }
    };

    const promise = runSave().finally(() => {
      shippingNoteSavingPromiseRef.current = null;
    });
    shippingNoteSavingPromiseRef.current = promise;
    return promise;
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const flush = () => saveShippingNoteIfNeeded();
    window.__checkoutFlushOrderComment = flush;
    return () => {
      if (window.__checkoutFlushOrderComment === flush) {
        delete window.__checkoutFlushOrderComment;
      }
    };
  }, [cart?.addNoteApi, saveShippingNoteIfNeeded]);

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
          onBlur={() => {
            void saveShippingNoteIfNeeded();
          }}
          placeholder={_('Add a comment for the order')}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none mb-0"
          rows={3}
        />
      </div>
    </div>
  );
}
