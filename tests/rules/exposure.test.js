import { describe, it, expect } from 'vitest';
import { calculateRelativeExposure } from '../../src/rules/exposure.js';

describe('Rules: exposure.js', () => {
  describe('Named Edge Case: exposure range always has low <= value <= high', () => {
    it('strictly satisfies low <= percentChange <= high under typical reductions', () => {
      const result = calculateRelativeExposure({
        activity: 'walk',
        outdoorMinutes: 60,
        usualPm25: 180,
        recommendedPm25: 60,
        outdoorAllowed: true,
      });

      expect(result.low).toBeLessThanOrEqual(result.percentChange);
      expect(result.percentChange).toBeLessThanOrEqual(result.high);
      expect(result.percentChange).toBeGreaterThan(0);
    });

    it('strictly satisfies low <= percentChange <= high when activity is shifted indoors', () => {
      const result = calculateRelativeExposure({
        activity: 'exercise',
        outdoorMinutes: 90,
        usualPm25: 260,
        recommendedPm25: 180,
        outdoorAllowed: false, // shifted indoors due to high pollution
      });

      expect(result.low).toBeLessThanOrEqual(result.percentChange);
      expect(result.percentChange).toBeLessThanOrEqual(result.high);
      expect(result.percentChange).toBeGreaterThan(0);
    });

    it('strictly satisfies low <= percentChange <= high when there is zero reduction', () => {
      const result = calculateRelativeExposure({
        activity: 'play',
        outdoorMinutes: 45,
        usualPm25: 50,
        recommendedPm25: 50,
        outdoorAllowed: true,
      });

      expect(result.low).toBeLessThanOrEqual(result.percentChange);
      expect(result.percentChange).toBeLessThanOrEqual(result.high);
      expect(result.percentChange).toBe(0);
    });

    it('strictly satisfies low <= percentChange <= high across all supported activities', () => {
      const activities = ['walk', 'cycle', 'exercise', 'play', 'errands', 'commute'];
      for (const activity of activities) {
        const res = calculateRelativeExposure({
          activity,
          outdoorMinutes: 60,
          usualPm25: 150,
          recommendedPm25: 50,
        });
        expect(res.low).toBeLessThanOrEqual(res.percentChange);
        expect(res.percentChange).toBeLessThanOrEqual(res.high);
      }
    });
  });

  describe('Disclaimer and relative claim adherence', () => {
    it('includes disclaimer without making absolute health claims', () => {
      const result = calculateRelativeExposure({
        activity: 'walk',
        outdoorMinutes: 60,
        usualPm25: 120,
        recommendedPm25: 40,
      });

      expect(result.note).toContain('Relative exposure reduction');
      expect(result.note).toContain('Not medical advice');
      expect(result.note).not.toContain('cures');
      expect(result.note).not.toContain('prevents asthma');
    });
  });

  describe('Zero outdoor minutes', () => {
    it('returns zero change when outdoor duration is 0', () => {
      const result = calculateRelativeExposure({
        activity: 'walk',
        outdoorMinutes: 0,
        usualPm25: 200,
        recommendedPm25: 50,
      });

      expect(result.percentChange).toBe(0);
      expect(result.low).toBeLessThanOrEqual(result.percentChange);
      expect(result.percentChange).toBeLessThanOrEqual(result.high);
    });
  });
});
