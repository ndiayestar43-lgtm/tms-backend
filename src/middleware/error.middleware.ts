import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { env } from '../config/env';

// ========================
// CLASSE D'ERREUR API
// ========================

export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const createApiError = (message: string, statusCode: number): ApiError => {
  return new ApiError(message, statusCode);
};

// ========================
// HANDLER ERREUR GLOBAL
// ========================

export const errorHandler = (
  err: Error | ApiError | ZodError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  // Erreur Zod (validation)
  if (err instanceof ZodError) {
    const errors = err.issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors,
    });
    return;
  }

  // Erreur Mongoose - ID invalide
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      message: 'Identifiant invalide',
    });
    return;
  }

  // Erreur Mongoose - Doublon
  if ('code' in err && (err as NodeJS.ErrnoException).code === 11000) {
    const keyValue = (err as Record<string, unknown>).keyValue as Record<string, unknown>;
    const field = Object.keys(keyValue || {})[0];
    res.status(409).json({
      success: false,
      message: `Cette valeur est déjà utilisée pour le champ: ${field}`,
    });
    return;
  }

  // Erreur Mongoose - Validation
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    res.status(400).json({
      success: false,
      message: 'Erreur de validation',
      errors,
    });
    return;
  }

  // Erreur API opérationnelle
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // Erreur inconnue
  const statusCode = 500;
  const message =
    env.NODE_ENV === 'production'
      ? 'Une erreur interne est survenue'
      : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

// ========================
// ROUTE INTROUVABLE
// ========================

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route introuvable: ${req.method} ${req.originalUrl}`,
  });
};
