/**
 * Migration: set calculate_api for pickup shipping method.
 */
import { PoolClient } from 'pg';

const PICKUP_METHOD_UUID = 'd3d16c61-5acf-4cf7-93d9-258e753cd58b';
const CALCULATE_API = 'shippingCalculate';

export default async function (connection: PoolClient) {
  console.log('[craftarmor-shipping] Updating shipping_zone_method calculate_api...');

  await connection.query(
    `
      UPDATE shipping_zone_method
      SET calculate_api = $1,
          cost = NULL
      WHERE method_id IN (
        SELECT shipping_method_id
        FROM shipping_method
        WHERE uuid = $2
      )
    `,
    [CALCULATE_API, PICKUP_METHOD_UUID]
  );

  console.log('[craftarmor-shipping] Migration Version-1.0.6 completed successfully');
}
