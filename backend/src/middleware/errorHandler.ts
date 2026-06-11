import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Unhandled Error]', err);

  res.status(500).json({
    error: 'An unexpected error occurred. Please try again.',
  });
}
