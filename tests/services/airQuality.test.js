import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fetchAirQuality, airQualityCache } from '../../src/services/airQuality.js';
import { UpstreamTimeoutError, UpstreamApiError } from '../../src/errors.js';

describe('Air Quality Service', () => {
  beforeEach(() => {
    airQualityCache.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mockForecastData = {
    latitude: 25.6,
    longitude: 85.12,
    timezone: 'Asia/Kolkata',
    hourly: {
      time: ['2026-11-23T00:00', '2026-11-23T01:00'],
      pm2_5: [145.2, 160.8],
      pm10: [210.5, 230.1],
      us_aqi: [197, 211],
    },
  };

  it('fetches air quality forecast successfully', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockForecastData,
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await fetchAirQuality(25.60, 85.12);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(data.hourly.pm2_5).toHaveLength(2);
    expect(data.hourly.pm2_5[0]).toBe(145.2);
  });

  it('cache hit avoids second fetch for identical coordinates', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockForecastData,
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchAirQuality(25.60, 85.12);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await fetchAirQuality(25.60, 85.12);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('cache hit keys by lat/lon rounded to 2 decimals', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockForecastData,
    });
    vi.stubGlobal('fetch', fetchMock);

    // 25.601 rounds to 25.60, 85.124 rounds to 85.12
    await fetchAirQuality(25.601, 85.124);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 25.604 rounds to 25.60, 85.119 rounds to 85.12 -> same cache key
    const cachedResult = await fetchAirQuality(25.604, 85.119);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cachedResult).toEqual(mockForecastData);
  });

  it('throws UpstreamTimeoutError on timeout/abort', async () => {
    const fetchMock = vi.fn().mockImplementation((_url, { signal }) => {
      return new Promise((_, reject) => {
        signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchAirQuality(25.6, 85.12, { timeoutMs: 50 })
    ).rejects.toThrow(UpstreamTimeoutError);
  });

  it('throws UpstreamApiError when upstream returns 500 error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAirQuality(25.6, 85.12)).rejects.toThrow(UpstreamApiError);
  });

  it('rejects invalid non-numeric coordinates', async () => {
    await expect(fetchAirQuality('invalid', 'coords')).rejects.toThrow(
      'Valid numeric latitude and longitude are required'
    );
  });
});
