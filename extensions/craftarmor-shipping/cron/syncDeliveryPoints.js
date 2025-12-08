// TODO: wire into EverShop cron runner (daily sync)
export default {
  schedule: '0 3 * * *', // daily at 03:00
  handler: async () => {
    throw new Error('Not implemented: syncDeliveryPoints cron');
  }
};
