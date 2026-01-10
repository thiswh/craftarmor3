import { EmailField } from '@components/common/form/EmailField.js';
import { PasswordField } from '@components/common/form/PasswordField.js';
import { useCartState } from '@components/frontStore/cart/CartContext.js';
import {
  useCheckout,
  useCheckoutDispatch
} from '@components/frontStore/checkout/CheckoutContext.js';
import {
  useCustomer,
  useCustomerDispatch
} from '@components/frontStore/customer/CustomerContext.jsx';
import { _ } from '@evershop/evershop/lib/locale/translate/_';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

const LoggedIn: React.FC<{
  fullName: string;
  email: string;
  uuid: string;
  recipientName: string;
  recipientPhone: string;
  onChangeRecipient: () => void;
}> = ({
  uuid,
  fullName,
  email,
  recipientName,
  recipientPhone,
  onChangeRecipient
}) => {
  const { updateCheckoutData } = useCheckoutDispatch();

  useEffect(() => {
    updateCheckoutData({
      customer: {
        id: uuid,
        email: email,
        fullName: fullName
      }
    });
  }, [fullName, email]);

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="text-gray-500">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0 text-sm font-medium text-gray-900">
            <span>{recipientName || fullName || '—'}</span>
            {recipientPhone ? (
              <span className="ml-2 text-gray-600">{recipientPhone}</span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="text-gray-400 hover:text-gray-700"
          onClick={onChangeRecipient}
          aria-label={_('Change')}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

const Guest: React.FC<{
  email: string;
}> = ({ email }) => {
  const [showLogin, setShowLogin] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const isMounted = useRef(true);
  const { login } = useCustomerDispatch();
  const { form } = useCheckout();
  const { updateCheckoutData } = useCheckoutDispatch();
  const contactEmail = form.watch('contact.email', email);
  const handleLoginClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowLogin(true);
  };

  useEffect(() => {
    updateCheckoutData({
      customer: {
        email: contactEmail
      }
    });
  }, [contactEmail]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleLogin = async () => {
    if (isLogging) return;

    try {
      setIsLogging(true);
      const isValid = await form.trigger(['contact.email', 'contact.password']);
      if (!isValid) {
        return;
      }
      const formData = form.getValues();
      const loginEmail = formData?.contact?.email;
      const password = formData?.contact?.password;
      await login(loginEmail, password, '');
      toast.success(_('Successfully logged in'));
      if (isMounted.current) {
        setShowLogin(false);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : _('Login failed');
      toast.error(errorMessage);
    } finally {
      if (isMounted.current) {
        setIsLogging(false);
      }
    }
  };

  const handleCancelLogin = () => {
    setShowLogin(false);
    // Clear password field
    form.setValue('contact.password', '');
  };

  return (
    <div>
      <EmailField
        defaultValue={email}
        name="contact.email"
        label={_('Email')}
        required
        validation={{
          required: _('Email is required')
        }}
        placeholder={_('Enter your email')}
      />

      {showLogin && (
        <div className="mt-4">
          <PasswordField
            name="contact.password"
            label={_('Password')}
            required
            validation={{
              required: _('Password is required')
            }}
            placeholder={_('Enter your password')}
          />
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleLogin}
              disabled={isLogging}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLogging ? _('Logging in...') : _('Log in')}
            </button>
            <button
              type="button"
              onClick={handleCancelLogin}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            >
              {_('Cancel')}
            </button>
          </div>
        </div>
      )}

      {!showLogin && (
        <p className="mt-2">
          {_('Already have an account?')}{' '}
          <button
            type="button"
            onClick={handleLoginClick}
            className="underline text-blue-600 hover:text-blue-800"
          >
            {_('Log in')}
          </button>
        </p>
      )}
    </div>
  );
};
export function ContactInformation() {
  const { customer } = useCustomer();
  const { data: cart } = useCartState();
  const { form } = useCheckout();
  const watchedShippingAddress = form.watch('shippingAddress');
  const recipientName =
    watchedShippingAddress?.full_name || customer?.fullName || '';
  const recipientPhone =
    watchedShippingAddress?.telephone || (customer as any)?.phone || '';
  const handleChangeRecipient = () => {
    if (typeof window === 'undefined') {
      return;
    }
    window.dispatchEvent(new CustomEvent('checkout:open-recipient-panel'));
  };

  return (
    <div className="checkout-contact checkout-step">
      <h3>{_('Recipient')}</h3>
      {customer ? (
        <LoggedIn
          fullName={customer.fullName}
          email={customer.email}
          uuid={customer.uuid}
          recipientName={recipientName}
          recipientPhone={recipientPhone}
          onChangeRecipient={handleChangeRecipient}
        />
      ) : (
        <Guest email={cart.customerEmail || ''} />
      )}
    </div>
  );
}
