import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { geocodeCity, geocodeCache } from '../../src/services/geocode.js';
import {
  GeocodeNotFoundError,
  UpstreamTimeoutError,
  UpstreamApiError,
} from '../../src/errors.js';

describe('Geocode Service', () => {
  beforeEach(() => {
    geocodeCache.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches coordinates for a city and formats response', async () => {
    const mockApiResponse = {
      results: [
        {
          id: 1269750,
          name: 'Patna',
          latitude: 25.60,
          longitude: 85.12,
          country: 'India',
          country_code: 'IN',
          timezone: 'Asia/Kolkata',
          population: 1684222,
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await geocodeCity('Patna');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.name).toBe('Patna');
    expect(result.country).toBe('India');
    expect(result.countryCode).toBe('IN');
    expect(result.lat).toBe(25.60);
    expect(result.lon).toBe(85.12);
  });

  it('prefers country_code === "IN" if multiple results exist', async () => {
    const mockApiResponse = {
      results: [
        {
          id: 1,
          name: 'Delhi',
          country: 'United States',
          country_code: 'US',
          latitude: 42.27,
          longitude: -74.91,
        },
        {
          id: 2,
          name: 'Delhi',
          country: 'India',
          country_code: 'IN',
          latitude: 28.65,
          longitude: 77.23,
          timezone: 'Asia/Kolkata',
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await geocodeCity('Delhi');
    expect(result.countryCode).toBe('IN');
    expect(result.country).toBe('India');
    expect(result.lat).toBe(28.65);
  });

  it('cache hit avoids second fetch call', async () => {
    const mockApiResponse = {
      results: [
        {
          id: 1269750,
          name: 'Patna',
          latitude: 25.60,
          longitude: 85.12,
          country: 'India',
          country_code: 'IN',
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    // First call: calls fetch
    const first = await geocodeCity('Patna');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call: served from cache
    const second = await geocodeCity('Patna');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);

    // Case-insensitive check
    const third = await geocodeCity('  patna  ');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(third).toEqual(first);
  });

  it('throws GeocodeNotFoundError when city is not found (empty results)', async () => {
    const mockApiResponse = { results: [] };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(geocodeCity('NonExistentCityXYZ')).rejects.toThrow(
      GeocodeNotFoundError
    );
  });

  it('throws GeocodeNotFoundError when results field is missing', async () => {
    const mockApiResponse = {};
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(geocodeCity('Nowhere')).rejects.toThrow(GeocodeNotFoundError);
  });

  it('throws UpstreamTimeoutError on network timeout/abort', async () => {
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

    await expect(geocodeCity('Patna', { timeoutMs: 50 })).rejects.toThrow(
      UpstreamTimeoutError
    );
  });

  it('throws UpstreamApiError on HTTP error status from upstream', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(geocodeCity('Patna')).rejects.toThrow(UpstreamApiError);
  });
});
