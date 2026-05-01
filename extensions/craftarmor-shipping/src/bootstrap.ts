/**
 * Bootstrap file для расширения craftarmor-shipping
 * Выполняется при запуске приложения EverShop
 */
import { registerJob } from '@evershop/evershop/lib/cronjob';
import { addProcessor } from '@evershop/evershop/lib/util/registry';
import { hookAfter, hookBefore } from '@evershop/evershop/lib/util/hookable';
import { insert, select } from '@evershop/postgres-query-builder';
import { pool } from '@evershop/evershop/lib/postgres';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';

type StagedCheckoutSplit = {
  unselectedItems: any[];
};

const stagedCheckoutMap = new WeakMap<any, StagedCheckoutSplit>();

function isItemSelected(item: any): boolean {
  return item?.getData?.('is_selected') !== false;
}

export default async function bootstrap() {
  console.log('[craftarmor-shipping] Extension loaded successfully!');
  
  // Получаем путь к скомпилированному файлу задачи
  // dist/bootstrap.js -> dist/jobs/syncDeliveryPoints.js
  const __filename = url.fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const jobPath = path.resolve(__dirname, 'jobs', 'syncDeliveryPoints.js');
  
  // Проверяем, что файл существует
  if (!fs.existsSync(jobPath)) {
    console.warn(`[craftarmor-shipping] Job file not found: ${jobPath}. Make sure to compile the extension.`);
    return;
  }
  
  // Регистрируем cron job для синхронизации пунктов выдачи
  // Запуск каждый день в 03:00
  registerJob({
    name: 'syncDeliveryPoints',
    resolve: jobPath,
    schedule: '0 3 * * *',
    enabled: true
  });

  console.log('[craftarmor-shipping] Cron job registered: syncDeliveryPoints (daily at 03:00)');

  // Регистрируем процессор для добавления полей размеров в cart item
  const processorPath = path.resolve(__dirname, 'services', 'registerCartItemDimensions.js');
  if (fs.existsSync(processorPath)) {
    // Преобразуем путь в file:// URL для Windows совместимости с ESM
    const processorUrl = url.pathToFileURL(processorPath).href;
    const registerCartItemDimensions = (await import(processorUrl)).default;
    addProcessor('cartItemFields', registerCartItemDimensions, 10);
    console.log('[craftarmor-shipping] Cart item dimensions processor registered');
  } else {
    console.warn(`[craftarmor-shipping] Processor file not found: ${processorPath}. Make sure to compile the extension.`);
  }

  // Регистрируем процессор для добавления полей total_length/total_width/total_height в cart
  const cartDimensionsProcessorPath = path.resolve(__dirname, 'services', 'registerCartDimensionsFields.js');
  if (fs.existsSync(cartDimensionsProcessorPath)) {
    const cartDimensionsProcessorUrl = url.pathToFileURL(cartDimensionsProcessorPath).href;
    const registerCartDimensionsFields = (await import(cartDimensionsProcessorUrl)).default;
    addProcessor('cartFields', registerCartDimensionsFields, 10);
    console.log('[craftarmor-shipping] Cart dimensions fields processor registered');
  } else {
    console.warn(`[craftarmor-shipping] Cart dimensions processor file not found: ${cartDimensionsProcessorPath}. Make sure to compile the extension.`);
  }

  // Partial checkout flow:
  // 1) create order from selected cart items only
  // 2) keep unselected items in a new active cart
  hookBefore(
    'createOrderFunc',
    async function splitCartItemsForOrder(cart: any) {
      const allItems = Array.isArray(cart?.getItems?.()) ? cart.getItems() : [];
      if (allItems.length === 0) {
        return;
      }

      const cartId = Number(cart?.getData?.('cart_id') || 0);
      let selectedUuidSet = new Set<string>();

      if (cartId > 0) {
        const selectedRows = await pool.query(
          `
            SELECT uuid::text
            FROM cart_item
            WHERE cart_id = $1
              AND is_selected = TRUE
          `,
          [cartId]
        );
        selectedUuidSet = new Set(
          (selectedRows.rows || [])
            .map((row: any) => String(row.uuid || '').trim())
            .filter(Boolean)
        );
      }

      const selectedItems =
        selectedUuidSet.size > 0
          ? allItems.filter((item: any) =>
              selectedUuidSet.has(String(item?.getData?.('uuid') || ''))
            )
          : allItems.filter((item: any) => isItemSelected(item));

      const unselectedItems =
        selectedUuidSet.size > 0
          ? allItems.filter(
              (item: any) =>
                !selectedUuidSet.has(String(item?.getData?.('uuid') || ''))
            )
          : allItems.filter((item: any) => !isItemSelected(item));

      if (selectedItems.length === 0) {
        throw new Error('Select at least one item to place order');
      }

      stagedCheckoutMap.set(cart, { unselectedItems });

      if (unselectedItems.length > 0) {
        await cart.setData('items', selectedItems, true);
      }
    },
    5
  );

  hookAfter(
    'createOrderFunc',
    async function restoreUnselectedItemsToNewCart(_order: any, cart: any) {
      const staged = stagedCheckoutMap.get(cart);
      stagedCheckoutMap.delete(cart);

      if (!staged || !Array.isArray(staged.unselectedItems) || staged.unselectedItems.length === 0) {
        return;
      }

      const sourceCart = await select()
        .from('cart')
        .where('cart_id', '=', cart.getData('cart_id'))
        .load(pool);

      if (!sourceCart) {
        return;
      }

      const {
        cart_id: _sourceCartId,
        uuid: _sourceCartUuid,
        created_at: _sourceCreatedAt,
        updated_at: _sourceUpdatedAt,
        ...sourceCartData
      } = sourceCart;

      const newCartInsert = await insert('cart')
        .given({
          ...sourceCartData,
          uuid: uuidv4().replace(/-/g, ''),
          status: true,
          shipping_address_id: null,
          billing_address_id: null,
          shipping_zone_id: null,
          shipping_method: null,
          shipping_method_name: null,
          shipping_fee_excl_tax: 0,
          shipping_fee_incl_tax: 0,
          shipping_tax_amount: 0
        })
        .execute(pool);

      const newCartId = newCartInsert.insertId;

      await Promise.all(
        staged.unselectedItems.map(async (item: any) => {
          const exported = item.export?.() || {};
          const { cart_item_id: _oldCartItemId, uuid: _oldUuid, ...data } = exported;
          await insert('cart_item')
            .given({
              ...data,
              cart_id: newCartId,
              uuid: uuidv4().replace(/-/g, ''),
              is_selected: true
            })
            .execute(pool);
        })
      );
    },
    20
  );

  console.log('[craftarmor-shipping] Partial checkout hooks registered');
}
