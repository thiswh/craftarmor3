/**
 * Bootstrap file для расширения craftarmor-shipping
 * Выполняется при запуске приложения EverShop
 */
import { registerJob } from '@evershop/evershop/lib/cronjob';
import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';

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
}


