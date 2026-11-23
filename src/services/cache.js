import { config } from '../config.js';

export class MemoryCache {
  constructor(defaultTtlMs = config.CACHE_TTL_MS || 1800000) {
    this.defaultTtlMs = defaultTtlMs;
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    return this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  get size() {
    // Purge expired keys before reporting size
    const now = Date.now();
    for (const [k, v] of this.store.entries()) {
      if (now > v.expiresAt) {
        this.store.delete(k);
      }
    }
    return this.store.size;
  }
}

export const formatLatLonKey = (lat, lon) =>
  `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;

export default MemoryCache;
