/**
 * Расширение типа Express Response для поддержки EverShop $body
 */
import { Response } from 'express';

declare module 'express' {
  interface Response {
    $body?: any;
  }
}

