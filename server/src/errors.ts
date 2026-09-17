import type { NextFunction, Request, Response } from 'express';
import type { ApiError } from './types.js';

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export function notFoundHandler(req: Request, res: Response) {
  const body: ApiError = {
    error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.path}` },
  };
  res.status(404).json(body);
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const withCode = err as { statusCode?: number; code?: string; details?: unknown } | null;
  if (err instanceof Error && typeof withCode?.statusCode === 'number' && typeof withCode.code === 'string') {
    const body: ApiError = {
      error: {
        code: withCode.code,
        message: err.message,
        ...(withCode.details !== undefined ? { details: withCode.details } : {}),
      },
    };
    res.status(withCode.statusCode).json(body);
    return;
  }
  const anyErr = err as { type?: string; statusCode?: number };
  if (anyErr?.type === 'entity.parse.failed') {
    const body: ApiError = {
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' },
    };
    res.status(400).json(body);
    return;
  }
  console.error(err);
  const body: ApiError = {
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  };
  res.status(500).json(body);
}
