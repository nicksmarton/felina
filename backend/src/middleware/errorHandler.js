import { logger } from '../utils/logger.js';

export function createAppError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  Error.captureStackTrace(error, createAppError);
  return error;
}

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error('Error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};

