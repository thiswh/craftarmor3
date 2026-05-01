import { getConfig } from '@evershop/evershop/lib/util/getConfig';

type CarrierRecord = Record<string, { name: string; trackingUrl?: string }>;

export default {
  Query: {
    carriers: () => {
      const carriers = getConfig('oms.carriers', {}) as CarrierRecord;
      const allowedCodes = getConfig('oms.adminCarrierCodes', ['cdek']) as string[];
      const normalized = new Set(
        (Array.isArray(allowedCodes) ? allowedCodes : [])
          .map((code) => String(code || '').trim().toLowerCase())
          .filter(Boolean)
      );

      return Object.keys(carriers)
        .filter((code) => normalized.has(code.toLowerCase()))
        .map((code) => ({
          ...carriers[code],
          code
        }));
    }
  }
};
