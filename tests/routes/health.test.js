import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { app } from '../../src/server.js';
import { createRateLimiter } from '../../src/middleware/rateLimit.js';

describe('Health Route & Server Middleware', () => {
  it('GET /api/health returns 200 with ok status and uptime', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('includes security headers from helmet', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
    expect(res.headers).toHaveProperty('content-security-policy');
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
  });

  it('returns 404 with clean JSON error on unknown routes', async () => {
    const res = await request(app).get('/api/unknown-endpoint');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found: GET /api/unknown-endpoint',
      },
    });
    expect(res.body.stack).toBeUndefined();
  });

  it('rejects payloads larger than 20kb with 413', async () => {
    // Generate a payload > 20kb
    const largeString = 'a'.repeat(25 * 1024);
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send({ data: largeString });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload exceeds 20kb limit',
      },
    });
    expect(res.body.stack).toBeUndefined();
  });

  it('rate limiter returns 429 when max requests exceeded', async () => {
    const testApp = express();
    const strictLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      limit: 2,
    });
    testApp.use(strictLimiter);
    testApp.get('/test-limit', (req, res) => res.json({ ok: true }));

    const res1 = await request(testApp).get('/test-limit');
    expect(res1.status).toBe(200);

    const res2 = await request(testApp).get('/test-limit');
    expect(res2.status).toBe(200);

    const res3 = await request(testApp).get('/test-limit');
    expect(res3.status).toBe(429);
    expect(res3.body).toEqual({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.',
      },
    });
  });
});
