import { describe, it, expect } from 'vitest';
import { selectSwaps, allSwaps } from '../../src/rules/swaps.js';

describe('Rules: swaps.js', () => {
  it('loads 10–12 swaps from data/swaps.json as specified', () => {
    expect(allSwaps.length).toBeGreaterThanOrEqual(10);
    expect(allSwaps.length).toBeLessThanOrEqual(12);
  });

  it('includes clean-cooking-fuel swap only when household uses solid fuel', () => {
    const withSolidFuel = selectSwaps(
      { cookingFuel: 'solid-fuel', cookingTimes: ['morning'] },
      'Moderate',
      []
    );
    expect(withSolidFuel.some((s) => s.id === 'clean-cooking-fuel')).toBe(true);

    const withLpg = selectSwaps(
      { cookingFuel: 'lpg', cookingTimes: ['morning'] },
      'Moderate',
      []
    );
    expect(withLpg.some((s) => s.id === 'clean-cooking-fuel')).toBe(false);
  });

  it('includes carpool and cabin recirculation only when a member drives a car', () => {
    const withCar = selectSwaps(
      { cookingFuel: 'lpg' },
      'Moderate',
      [{ name: 'Rohan', commuteMode: 'car' }]
    );
    expect(withCar.some((s) => s.id === 'cabin-air-recirculation')).toBe(true);
    expect(withCar.some((s) => s.id === 'carpool-school-office')).toBe(true);

    const withWalker = selectSwaps(
      { cookingFuel: 'lpg' },
      'Moderate',
      [{ name: 'Rohan', commuteMode: 'walk' }]
    );
    expect(withWalker.some((s) => s.id === 'cabin-air-recirculation')).toBe(false);
  });

  it('includes peak smog window sealing swap only when band >= Poor', () => {
    const inPoorBand = selectSwaps({ cookingFuel: 'lpg' }, 'Poor', []);
    expect(inPoorBand.some((s) => s.id === 'close-windows-peak-smog')).toBe(true);

    const inGoodBand = selectSwaps({ cookingFuel: 'lpg' }, 'Good', []);
    expect(inGoodBand.some((s) => s.id === 'close-windows-peak-smog')).toBe(false);
  });

  it('always includes universal household swaps', () => {
    const swaps = selectSwaps({ cookingFuel: 'lpg' }, 'Good', []);
    const swapIds = swaps.map((s) => s.id);

    expect(swapIds).toContain('wet-mopping');
    expect(swapIds).toContain('no-indoor-incense');
    expect(swapIds).toContain('no-waste-burning');
    expect(swapIds).toContain('entryway-doormat');
  });

  it('formats every swap according to the specified output schema', () => {
    const swaps = selectSwaps(
      { cookingFuel: 'solid-fuel', cookingTimes: ['morning'] },
      'Severe',
      [{ name: 'Dad', commuteMode: 'car' }]
    );

    for (const swap of swaps) {
      expect(swap).toHaveProperty('id');
      expect(swap).toHaveProperty('title');
      expect(typeof swap.breatheLess).toBe('boolean');
      expect(typeof swap.emitLess).toBe('boolean');
      expect(['low', 'medium', 'high']).toContain(swap.impactLevel);
      expect(swap).toHaveProperty('why');
      expect(swap).toHaveProperty('source');
      // When impactRange is null in data, it must be omitted from response
      expect(swap.impactRange).toBeUndefined();
    }
  });
});
