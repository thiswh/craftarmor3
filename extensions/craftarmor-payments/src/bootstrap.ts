import { getConfig } from '@evershop/evershop/lib/util/getConfig';
import { registerPaymentMethod } from '../../../node_modules/@evershop/evershop/dist/modules/checkout/services/getAvailablePaymentMethos.js';
import { getSetting } from '../../../node_modules/@evershop/evershop/dist/modules/setting/services/setting.js';

export default async function bootstrap() {
  registerPaymentMethod({
    init: async () => ({
      code: 'yookassa_sbp',
      name: await getSetting('yookassaSbpDisplayName', 'SBP (YooKassa)')
    }),
    validator: async () => {
      const config = getConfig('system.yookassa', {});
      const statusFromConfig = (config as any)?.sbpStatus;
      const statusFromSettings = await getSetting('yookassaSbpStatus', 0);
      const status =
        statusFromConfig !== undefined ? statusFromConfig : statusFromSettings;
      return parseInt(String(status), 10) === 1;
    }
  });

  console.log('[craftarmor-payments] Payment method registered: yookassa_sbp');
}
