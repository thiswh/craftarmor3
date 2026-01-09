declare module '@evershop/evershop/types/customerAddress' {
  interface CustomerAddressGraphql {
    deliveryType?: string | null;
    pickupPointId?: number | null;
    pickupServiceCode?: string | null;
    pickupExternalId?: string | null;
    pickupData?: Record<string, unknown> | null;
  }
}
