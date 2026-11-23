import { ZodError } from 'zod';
import { AppError } from '../errors.js';

export const errorHandler = (err, req, res, _next) => {
  // Zod validation error
  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: message || 'Validation failed',
      },
    });
  }

  // Payload too large (express.json limit)
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload exceeds 20kb limit',
      },
    });
  }

  // Syntax error from malformed JSON body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON payload',
      },
    });
  }

  // Custom application error
  if (err instanceof AppError) {
    return res.status(err.statusCode || 500).json({
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: err.message,
      },
    });
  }

  // Default internal server error (never leak stack trace or internal messages)
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An internal server error occurred',
    },
  });
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
};

export default errorHandler;
