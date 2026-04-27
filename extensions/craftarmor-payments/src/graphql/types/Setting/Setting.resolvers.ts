export default {
  Setting: {
    yookassaSbpStatus: (setting: any[]) => {
      const entry = setting.find((s) => s.name === 'yookassaSbpStatus');
      return entry ? parseInt(entry.value, 10) : 0;
    },
    yookassaSbpDisplayName: (setting: any[]) => {
      const entry = setting.find((s) => s.name === 'yookassaSbpDisplayName');
      return entry ? entry.value : 'SBP (YooKassa)';
    },
    yookassaShopId: (setting: any[]) => {
      const entry = setting.find((s) => s.name === 'yookassaShopId');
      return entry ? entry.value : '';
    },
    yookassaSecretKey: (setting: any[]) => {
      const entry = setting.find((s) => s.name === 'yookassaSecretKey');
      return entry ? entry.value : '';
    }
  }
};

