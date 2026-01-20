/**
 * Migration: set calculate_api for courier shipping method.
 */
import { PoolClient } from 'pg';

const COURIER_METHOD_UUID = '1ad1dde4-0b52-4fb9-965f-8c3b5be739e7';
const CALCULATE_API = 'shippingCalculateCourier';

export default async function (connection: PoolClient) {
  console.log('[craftarmor-shipping] Updating courier calculate_api...');

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
    [CALCULATE_API, COURIER_METHOD_UUID]
  );

  console.log('[craftarmor-shipping] Migration Version-1.1.1 completed successfully');
}
