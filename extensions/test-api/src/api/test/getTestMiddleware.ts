import { Request, Response } from 'express';

/**
 * Middleware для обработки GET запроса на /test
 * Возвращает JSON с тестовыми данными
 */
export default async function getTestMiddleware(request: Request, response: Response) {
  // Возвращаем JSON ответ
  response.json({
    success: true,
    message: 'Test API endpoint is working!',
    data: {
      timestamp: new Date().toISOString(),
      shop: {
        name: 'CraftArmor',
        language: 'ru',
        currency: 'RUB'
      },
      extension: {
        name: 'test-api',
        version: '1.0.0',
        description: 'Test extension for EverShop'
      }
    }
  });
}

