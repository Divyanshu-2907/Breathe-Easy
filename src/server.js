import express from 'express';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { securityMiddleware } from './middleware/security.js';
import { rateLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import healthRouter from './routes/health.js';

const app = express();

// Security headers (Helmet with strict CSP)
app.use(securityMiddleware);

// Rate limiting
app.use(rateLimiter);

// Parse JSON with 20kb limit
app.use(express.json({ limit: '20kb' }));

// Health check endpoint
app.use('/api/health', healthRouter);

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

export { app };
export default app;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = config.PORT || 3000;
  app.listen(port, () => {
    console.log(`BreatheEasy server running on port ${port} (${config.NODE_ENV})`);
  });
}
