import { config } from '../config.js';
import { MemoryCache } from './cache.js';
import {
  GeocodeNotFoundError,
  UpstreamTimeoutError,
  UpstreamApiError,
} from '../errors.js';

export const geocodeCache = new MemoryCache(config.CACHE_TTL_MS);

export async function geocodeCity(city, options = {}) {
  const timeoutMs = options.timeoutMs || config.TIMEOUT_MS || 8000;
  const cache = options.cache || geocodeCache;
  const normalizedCity = city.trim().toLowerCase();
  const cacheKey = `geocode:${normalizedCity}`;

  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    city.trim()
  )}&count=10&language=en`;

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
      throw new UpstreamTimeoutError('Open-Meteo Geocoding', timeoutMs);
    }
    throw new UpstreamApiError('Open-Meteo Geocoding', 500, err.message);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new UpstreamApiError(
      'Open-Meteo Geocoding',
      response.status,
      response.statusText
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new UpstreamApiError(
      'Open-Meteo Geocoding',
      502,
      `Invalid JSON response: ${err.message}`
    );
  }

  if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
    throw new GeocodeNotFoundError(city);
  }

  // Prefer country_code === 'IN' (India) if multiple results
  const match =
    data.results.find((item) => item.country_code?.toUpperCase() === 'IN') ||
    data.results[0];

  const result = {
    name: match.name,
    country: match.country,
    countryCode: match.country_code,
    lat: match.latitude,
    lon: match.longitude,
    latitude: match.latitude,
    longitude: match.longitude,
    timezone: match.timezone || 'auto',
    population: match.population,
    admin1: match.admin1,
  };

  cache.set(cacheKey, result);
  return result;
}

export default geocodeCity;
