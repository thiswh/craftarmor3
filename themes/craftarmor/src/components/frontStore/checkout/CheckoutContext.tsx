import {
  useCartState,
  useCartDispatch
} from '@components/frontStore/cart/CartContext.js';
import { _ } from '@evershop/evershop/lib/locale/translate/_';
import { produce } from 'immer';
import React, {
  createContext,
  useReducer,
  useContext,
  useCallback,
  useMemo
} from 'react';

declare global {
  interface Window {
    __checkoutFlushOrderComment?: () => Promise<boolean>;
  }
}

const flushOrderCommentBeforeSubmit = async (): Promise<boolean> => {
  if (typeof window === 'undefined') {
    return true;
  }
  const flush = window.__checkoutFlushOrderComment;
  if (typeof flush !== 'function') {
    return true;
  }
  try {
    return (await flush()) !== false;
  } catch (error) {
    return false;
  }
};

const initialState = {
  orderPlaced: false,
  orderId: undefined,
  loadingStates: {
    placingOrder: false
  },
  allowGuestCheckout: false,
  checkoutData: {},
  registeredPaymentComponents: {}
};

const checkoutReducer = (state, action) =>
  produce(state, (draft) => {
    switch (action.type) {
      case 'SET_PLACING_ORDER':
        draft.loadingStates.placingOrder = action.payload;
        break;
      case 'SET_ORDER_PLACED':
        draft.orderPlaced = true;
        draft.orderId = action.payload.orderId;
        draft.loadingStates.placingOrder = false;
        break;
      case 'SET_CHECKOUT_DATA':
        draft.checkoutData = action.payload;
        break;
      case 'UPDATE_CHECKOUT_DATA':
        draft.checkoutData = { ...draft.checkoutData, ...action.payload };
        break;
      case 'CLEAR_CHECKOUT_DATA':
        draft.checkoutData = {};
        break;
      case 'REGISTER_PAYMENT_COMPONENT':
        draft.registeredPaymentComponents[action.payload.code] =
          action.payload.component;
        break;
      default:
        break;
    }
  });

const CheckoutContext = createContext(undefined);
const CheckoutDispatchContext = createContext(undefined);

const retry = async (fn, retries = 3, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export function CheckoutProvider({
  children,
  placeOrderApi,
  checkoutSuccessUrl,
  allowGuestCheckout = false,
  form,
  enableForm,
  disableForm
}) {
  const [state, dispatch] = useReducer(checkoutReducer, {
    ...initialState,
    allowGuestCheckout
  });

  const cartState = useCartState();
  const cartDispatch = useCartDispatch();
  const cartId = cartState?.data?.uuid;

  const getPaymentMethods = useCallback(
    () =>
      (cartState.data?.availablePaymentMethods || []).map((method) => ({
        code: method.code,
        name: method.name
      })),
    [cartState.data?.availablePaymentMethods]
  );

  const getShippingMethods = useCallback(
    async (params) => {
      if (params) {
        try {
          await cartDispatch.fetchAvailableShippingMethods(params);
          const methods = cartState.data?.availableShippingMethods || [];
          return methods.map((method) => ({
            code: method.code,
            name: method.name,
            cost: method.cost || { value: 0, text: 'Free' }
          }));
        } catch (error) {
          return [];
        }
      }
      return (cartState.data?.availableShippingMethods || []).map((method) => ({
        code: method.code,
        name: method.name,
        cost: method.cost || { value: 0, text: 'Free' }
      }));
    },
    [cartDispatch, cartState.data?.availableShippingMethods]
  );

  const requiresShipment = useMemo(() => true, [cartState?.data?.items]);

  const placeOrder = useCallback(async () => {
    if (!cartId) {
      throw new Error('Cart ID is required to place order');
    }

    const noteSaved = await flushOrderCommentBeforeSubmit();
    if (!noteSaved) {
      return;
    }

    dispatch({ type: 'SET_PLACING_ORDER', payload: true });
    const response = await retry(() =>
      fetch(placeOrderApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart_id: cartId })
      })
    );
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error?.message || _('Failed to place order'));
    }
    dispatch({
      type: 'SET_ORDER_PLACED',
      payload: { orderId: json.data.uuid }
    });
    return json.data;
  }, [placeOrderApi, cartId]);

  const checkout = useCallback(async () => {
    if (!cartId) {
      throw new Error(_('Cart ID is required to checkout'));
    }

    const isValid = await form.trigger(undefined, {
      shouldFocus: true
    });
    if (!isValid) {
      return;
    }

    const noteSaved = await flushOrderCommentBeforeSubmit();
    if (!noteSaved) {
      return;
    }

    disableForm();
    dispatch({ type: 'SET_PLACING_ORDER', payload: true });
    const response = await retry(() =>
      fetch(cartState.data?.checkoutApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart_id: cartId,
          ...state.checkoutData
        })
      })
    );
    const json = await response.json();
    if (!response.ok) {
      enableForm();
      throw new Error(json.error?.message || _('Failed to checkout'));
    }
    dispatch({
      type: 'SET_ORDER_PLACED',
      payload: { orderId: json.data.uuid }
    });
    return json.data;
  }, [
    cartState.data?.checkoutApi,
    cartId,
    state.checkoutData,
    form,
    enableForm,
    disableForm
  ]);

  const setCheckoutData = useCallback((data) => {
    dispatch({ type: 'SET_CHECKOUT_DATA', payload: data });
  }, []);

  const updateCheckoutData = useCallback((data) => {
    dispatch({ type: 'UPDATE_CHECKOUT_DATA', payload: data });
  }, []);

  const clearCheckoutData = useCallback(() => {
    dispatch({ type: 'CLEAR_CHECKOUT_DATA' });
  }, []);

  const registerPaymentComponent = useCallback((code, component) => {
    dispatch({
      type: 'REGISTER_PAYMENT_COMPONENT',
      payload: { code, component }
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      ...state,
      cartId,
      checkoutSuccessUrl,
      requiresShipment,
      form,
      loading: state.loadingStates.placingOrder
    }),
    [state, cartId, checkoutSuccessUrl, requiresShipment, form]
  );

  const dispatchMethods = useMemo(
    () => ({
      placeOrder,
      checkout,
      getPaymentMethods,
      getShippingMethods,
      setCheckoutData,
      updateCheckoutData,
      clearCheckoutData,
      registerPaymentComponent,
      enableForm,
      disableForm
    }),
    [
      placeOrder,
      checkout,
      getPaymentMethods,
      getShippingMethods,
      setCheckoutData,
      updateCheckoutData,
      clearCheckoutData,
      registerPaymentComponent,
      enableForm,
      disableForm
    ]
  );

  return (
    <CheckoutDispatchContext.Provider value={dispatchMethods}>
      <CheckoutContext.Provider value={contextValue}>
        {children}
      </CheckoutContext.Provider>
    </CheckoutDispatchContext.Provider>
  );
}

export const useCheckout = () => {
  const context = useContext(CheckoutContext);
  if (context === undefined) {
    throw new Error('useCheckout must be used within a CheckoutProvider');
  }
  return context;
};

export const useCheckoutDispatch = () => {
  const context = useContext(CheckoutDispatchContext);
  if (context === undefined) {
    throw new Error('useCheckoutDispatch must be used within a CheckoutProvider');
  }
  return context;
};
