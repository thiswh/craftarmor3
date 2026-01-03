/**
 * Body parser middleware для POST /api/delivery/points
 * Парсит JSON body из запроса
 * 
 * В EverShop middleware с именем bodyParser.ts автоматически применяется перед другими middleware
 */
import { Request, Response, NextFunction } from 'express';
import express from 'express';

// Используем встроенный Express JSON parser
const jsonParser = express.json({ 
  limit: '10mb',
  strict: false 
});

export default function bodyParser(
  request: Request,
  response: Response,
  next: NextFunction
) {
  // Применяем JSON parser только для POST запросов
  if (request.method === 'POST') {
    jsonParser(request, response, (err?: any) => {
      if (err) {
        console.error('[bodyParser] Error parsing JSON:', err);
        response.status(400).json({
          success: false,
          message: 'Invalid JSON in request body',
          error: err.message
        });
        return;
      }
      next();
    });
  } else {
    next();
  }
}
