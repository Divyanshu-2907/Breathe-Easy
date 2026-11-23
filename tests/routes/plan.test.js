import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { app } from '../../src/server.js';
import * as geocodeService from '../../src/services/geocode.js';
import * as airQualityService from '../../src/services/airQuality.js';
import {
  GeocodeNotFoundError,
  UpstreamTimeoutError,
  UpstreamApiError,
} from '../../src/errors.js';
import { createRateLimiter } from '../../src/middleware/rateLimit.js';
import planRouter from '../../src/routes/plan.js';
import errorHandler from '../../src/middleware/errorHandler.js';

describe('Route: POST /api/plan', () => {
  const validRequestBody = {
    city: 'Patna',
    planDay: 'today',
    language: 'en',
    household: {
      cookingTimes: ['morning', 'evening'],
      cookingFuel: 'lpg',
      hasExhaust: true,
      hasPurifier: false,
    },
    members: [
      {
        name: 'Aarav',
        type: 'child',
        usualOutdoorTime: '07:30',
        outdoorMinutes: 60,
        activity: 'play',
      },
      {
        name: 'Sunita',
        type: 'adult',
        usualOutdoorTime: '08:30',
        outdoorMinutes: 45,
        activity: 'commute',
        commuteMode: 'car',
      },
    ],
  };

  const mockLocation = {
    name: 'Patna',
    country: 'India',
    lat: 25.6,
    lon: 85.12,
    timezone: 'Asia/Kolkata',
  };

  const mockAirQuality = {
    latitude: 25.6,
    longitude: 85.12,
    timezone: 'Asia/Kolkata',
    hourly: {
      time: Array.from({ length: 48 }, (_, i) => {
        const day = i < 24 ? '2026-11-23' : '2026-11-24';
        const hour = String(i % 24).padStart(2, '0');
        return `${day}T${hour}:00`;
      }),
      pm2_5: Array.from({ length: 48 }, (_, i) => {
        const hour = i % 24;
        if (hour >= 13 && hour <= 15) return 40;
        return 140;
      }),
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/plan successfully generates plan with mocked services', async () => {
    vi.spyOn(geocodeService, 'geocodeCity').mockResolvedValue(mockLocation);
    vi.spyOn(airQualityService, 'fetchAirQuality').mockResolvedValue(mockAirQuality);

    const res = await request(app)
      .post('/api/plan')
      .send(validRequestBody);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('location');
    expect(res.body.location.name).toBe('Patna');
    expect(res.body).toHaveProperty('forecastMeta');
    expect(res.body).toHaveProperty('protect');
    expect(res.body.protect.members).toHaveLength(2);
    expect(res.body).toHaveProperty('indoor');
    expect(res.body).toHaveProperty('cut');
    expect(res.body).toHaveProperty('community');
    expect(res.body).toHaveProperty('explanation');
    expect(res.body.disclaimer).toBe(
      'Estimates from a city-level model forecast. Not medical advice.'
    );
  });

  describe('Validation Failures', () => {
    it('returns 400 when body has invalid city characters or script tags', async () => {
      const res = await request(app)
        .post('/api/plan')
        .send({ ...validRequestBody, city: '<script>alert(1)</script>' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.stack).toBeUndefined();
    });

    it('returns 400 when body has unknown top-level keys', async () => {
      const res = await request(app)
        .post('/api/plan')
        .send({ ...validRequestBody, maliciousField: true });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.stack).toBeUndefined();
    });
  });

  describe('Upstream Failures -> clean JSON error, no stack trace', () => {
    it('returns 404 when city is not found by geocoding service', async () => {
      vi.spyOn(geocodeService, 'geocodeCity').mockRejectedValue(
        new GeocodeNotFoundError('NonExistentCity')
      );

      const res = await request(app)
        .post('/api/plan')
        .send({ ...validRequestBody, city: 'NonExistentCity' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: {
          code: 'GEOCODE_NOT_FOUND',
          message: 'City not found: NonExistentCity',
        },
      });
      expect(res.body.stack).toBeUndefined();
    });

    it('returns 504 when upstream service times out', async () => {
      vi.spyOn(geocodeService, 'geocodeCity').mockRejectedValue(
        new UpstreamTimeoutError('Open-Meteo Geocoding', 8000)
      );

      const res = await request(app)
        .post('/api/plan')
        .send(validRequestBody);

      expect(res.status).toBe(504);
      expect(res.body).toEqual({
        error: {
          code: 'UPSTREAM_TIMEOUT',
          message: 'Upstream service (Open-Meteo Geocoding) timed out after 8000ms',
        },
      });
      expect(res.body.stack).toBeUndefined();
    });

    it('returns 502 when upstream API returns a failure status', async () => {
      vi.spyOn(geocodeService, 'geocodeCity').mockResolvedValue(mockLocation);
      vi.spyOn(airQualityService, 'fetchAirQuality').mockRejectedValue(
        new UpstreamApiError('Open-Meteo Air Quality', 503, 'Service Unavailable')
      );

      const res = await request(app)
        .post('/api/plan')
        .send(validRequestBody);

      expect(res.status).toBe(502);
      expect(res.body).toEqual({
        error: {
          code: 'UPSTREAM_ERROR',
          message:
            'Upstream service (Open-Meteo Air Quality) failed with status 503: Service Unavailable',
        },
      });
      expect(res.body.stack).toBeUndefined();
    });
  });

  describe('Rate Limiting', () => {
    it('returns 429 when rate limit is exceeded on plan endpoint', async () => {
      const testApp = express();
      const testLimiter = createRateLimiter({
        windowMs: 60 * 1000,
        limit: 1, // Allow only 1 request
      });
      testApp.use(express.json());
      testApp.use(testLimiter);
      testApp.use('/api/plan', planRouter);
      testApp.use(errorHandler);

      vi.spyOn(geocodeService, 'geocodeCity').mockResolvedValue(mockLocation);
      vi.spyOn(airQualityService, 'fetchAirQuality').mockResolvedValue(mockAirQuality);

      // Request 1: Succeeds
      const res1 = await request(testApp)
        .post('/api/plan')
        .send(validRequestBody);
      expect(res1.status).toBe(200);

      // Request 2: Exceeds limit -> 429
      const res2 = await request(testApp)
        .post('/api/plan')
        .send(validRequestBody);
      expect(res2.status).toBe(429);
      expect(res2.body).toEqual({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later.',
        },
      });
      expect(res2.body.stack).toBeUndefined();
    });
  });
});
