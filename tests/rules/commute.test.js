import { describe, it, expect } from 'vitest';
import { evaluateCommute, EMISSION_RANKS } from '../../src/rules/commute.js';

describe('Rules: commute.js', () => {
  it('defines the correct emission rank per passenger', () => {
    expect(EMISSION_RANKS.walk).toBe(0);
    expect(EMISSION_RANKS.cycle).toBe(0);
    expect(EMISSION_RANKS.metro).toBe(1);
    expect(EMISSION_RANKS.bus).toBe(1);
    expect(EMISSION_RANKS['e-rickshaw']).toBe(2);
    expect(EMISSION_RANKS.auto).toBe(3);
    expect(EMISSION_RANKS['two-wheeler']).toBe(3);
    expect(EMISSION_RANKS.car).toBe(4);
  });

  describe('Named Edge Case: car commuter never gets a higher-emission suggestion', () => {
    it('only suggests options with rank <= 4 and includes carpool + cabin recirculation', () => {
      const result = evaluateCommute('car', 'Very Poor', '14:00–15:00');

      expect(result.currentRank).toBe(4);
      expect(result.cabinRecirculation).toBe(true);
      expect(result.carpoolSuggested).toBe(true);

      expect(result.actions).toContain('Keep car windows up and set AC to internal recirculation');
      expect(result.actions).toContain('Organize or join a carpool for school/office trips');

      for (const suggestion of result.suggestions) {
        expect(suggestion.rank).toBeLessThanOrEqual(4);
      }
    });
  });

  describe('Named Edge Case: walker gets time-shift before mode change', () => {
    it('suggests time-shift as first recommendation and never upgrades to higher emission vehicle', () => {
      const result = evaluateCommute('walk', 'Moderate', '15:00–16:00');

      expect(result.currentRank).toBe(0);
      expect(result.suggestions[0].type).toBe('time_shift');
      expect(result.suggestions[0].title).toBe('Shift commute timing');

      // Walker rank is 0; must NEVER suggest metro, bus, auto, car, etc.
      for (const suggestion of result.suggestions) {
        expect(suggestion.rank).toBeLessThanOrEqual(0);
      }
    });
  });

  describe('Two-wheeler & Auto commuters', () => {
    it('suggests mass transit (metro/bus) and e-rickshaws with rank <= 3', () => {
      const twoWheeler = evaluateCommute('two-wheeler', 'Poor');
      expect(twoWheeler.currentRank).toBe(3);

      for (const suggestion of twoWheeler.suggestions) {
        expect(suggestion.rank).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('Strict rank invariant across all modes', () => {
    it('verifies every mode only gets suggestions with rank <= currentRank', () => {
      const allModes = [
        'walk',
        'cycle',
        'metro',
        'bus',
        'e-rickshaw',
        'auto',
        'two-wheeler',
        'car',
      ];
      for (const mode of allModes) {
        const evalRes = evaluateCommute(mode, 'Poor');
        for (const s of evalRes.suggestions) {
          expect(s.rank).toBeLessThanOrEqual(EMISSION_RANKS[mode]);
        }
      }
    });
  });
});
