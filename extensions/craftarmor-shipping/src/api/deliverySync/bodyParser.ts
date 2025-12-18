/**
 * Middleware для парсинга JSON тела запроса
 * Используется для POST запросов в deliverySync endpoint
 */
import { Request, Response, NextFunction } from 'express';
import express from 'express';

const jsonParser = express.json({ 
  limit: '10mb',
  strict: false 
});

export default function bodyParser(
  request: Request,
  response: Response,
  next: NextFunction
) {
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
}
