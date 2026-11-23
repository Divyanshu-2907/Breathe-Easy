import { describe, it, expect, vi } from 'vitest';
import { MemoryCache, formatLatLonKey } from '../../src/services/cache.js';

describe('MemoryCache', () => {
  it('stores and retrieves cached values', () => {
    const cache = new MemoryCache(5000);
    cache.set('test-key', { sample: 123 });
    expect(cache.has('test-key')).toBe(true);
    expect(cache.get('test-key')).toEqual({ sample: 123 });
  });

  it('expires entries after TTL', () => {
    const cache = new MemoryCache(100);
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    cache.set('expiring-key', 'value', 100);
    expect(cache.get('expiring-key')).toBe('value');

    // Advance time by 101ms
    vi.spyOn(Date, 'now').mockReturnValue(now + 101);
    expect(cache.get('expiring-key')).toBeNull();
    expect(cache.has('expiring-key')).toBe(false);
  });

  it('supports deletion and clearing', () => {
    const cache = new MemoryCache();
    cache.set('k1', 1);
    cache.set('k2', 2);
    expect(cache.size).toBe(2);

    cache.delete('k1');
    expect(cache.has('k1')).toBe(false);
    expect(cache.size).toBe(1);

    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('formatLatLonKey rounds coordinates to 2 decimal places', () => {
    expect(formatLatLonKey(28.65195, 77.23149)).toBe('28.65,77.23');
    expect(formatLatLonKey('25.6', '85.12')).toBe('25.60,85.12');
  });
});
