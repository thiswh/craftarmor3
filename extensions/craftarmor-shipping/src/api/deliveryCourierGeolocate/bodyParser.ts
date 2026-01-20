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
  if (request.method === 'POST') {
    jsonParser(request, response, (err?: any) => {
      if (err) {
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
