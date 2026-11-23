import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import {
  GeocodeNotFoundError,
  UpstreamTimeoutError,
  UpstreamApiError,
} from '../../src/errors.js';
import { z } from 'zod';

describe('Error Handler Middleware', () => {
  const createMockRes = () => {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  it('formats ZodError into 400 with VALIDATION_ERROR code', () => {
    const testSchema = z.object({ city: z.string().min(2) });
    let zodErr;
    try {
      testSchema.parse({ city: 'A' });
    } catch (e) {
      zodErr = e;
    }

    const res = createMockRes();
    errorHandler(zodErr, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      })
    );
  });

  it('formats GeocodeNotFoundError into 404 with GEOCODE_NOT_FOUND code', () => {
    const err = new GeocodeNotFoundError('Atlantis');
    const res = createMockRes();
    errorHandler(err, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'GEOCODE_NOT_FOUND',
        message: 'City not found: Atlantis',
      },
    });
  });

  it('formats UpstreamTimeoutError into 504 with UPSTREAM_TIMEOUT code', () => {
    const err = new UpstreamTimeoutError('Open-Meteo', 8000);
    const res = createMockRes();
    errorHandler(err, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'UPSTREAM_TIMEOUT',
        message: 'Upstream service (Open-Meteo) timed out after 8000ms',
      },
    });
  });

  it('formats UpstreamApiError into 502 with UPSTREAM_ERROR code', () => {
    const err = new UpstreamApiError('Open-Meteo', 503, 'Unavailable');
    const res = createMockRes();
    errorHandler(err, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'UPSTREAM_ERROR',
        message: 'Upstream service (Open-Meteo) failed with status 503: Unavailable',
      },
    });
  });

  it('formats general unhandled error into 500 without leaking stack traces', () => {
    const secretError = new Error('Secret DB connection failed: secret_pwd_123');
    const res = createMockRes();
    errorHandler(secretError, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An internal server error occurred',
      },
    });
    // Ensure stack or internal details are not sent
    const responsePayload = res.json.mock.calls[0][0];
    expect(responsePayload.stack).toBeUndefined();
    expect(responsePayload.error.message).not.toContain('secret_pwd_123');
  });
});
