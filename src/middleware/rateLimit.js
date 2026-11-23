import rateLimit from 'express-rate-limit';

export const createRateLimiter = (options = {}) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later.',
        },
      });
    },
    ...options,
  });

export const rateLimiter = createRateLimiter();

export default rateLimiter;
