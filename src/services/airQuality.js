import { config } from '../config.js';
import { MemoryCache, formatLatLonKey } from './cache.js';
import { UpstreamTimeoutError, UpstreamApiError } from '../errors.js';

export const airQualityCache = new MemoryCache(config.CACHE_TTL_MS);

export async function fetchAirQuality(latitude, longitude, options = {}) {
  const lat = Number(latitude);
  const lon = Number(longitude);

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    throw new Error('Valid numeric latitude and longitude are required');
  }

  const timeoutMs = options.timeoutMs || config.TIMEOUT_MS || 8000;
  const cache = options.cache || airQualityCache;
  const cacheKey = `airQuality:${formatLatLonKey(lat, lon)}`;

  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const timezone = options.timezone || 'auto';
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5,pm10,us_aqi&timezone=${encodeURIComponent(
    timezone
  )}&forecast_days=2`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    if (err.name === 'AbortError' || controller.signal.aborted) {
      throw new UpstreamTimeoutError('Open-Meteo Air Quality', timeoutMs);
    }
    throw new UpstreamApiError('Open-Meteo Air Quality', 500, err.message);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new UpstreamApiError(
      'Open-Meteo Air Quality',
      response.status,
      response.statusText
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new UpstreamApiError(
      'Open-Meteo Air Quality',
      502,
      `Invalid JSON response: ${err.message}`
    );
  }

  cache.set(cacheKey, data);
  return data;
}

export default fetchAirQuality;
