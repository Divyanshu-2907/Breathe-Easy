import { describe, it, expect } from 'vitest';
import { evaluateActivity, INDOOR_ALTERNATIVES } from '../../src/rules/activities.js';

describe('Rules: activities.js', () => {
  describe('Outdoor allowance rules', () => {
    it('allows adults to exercise outdoors up to Moderate band', () => {
      expect(evaluateActivity('exercise', 'adult', 'Good').outdoorAllowed).toBe(true);
      expect(evaluateActivity('exercise', 'adult', 'Satisfactory').outdoorAllowed).toBe(true);
      expect(evaluateActivity('exercise', 'adult', 'Moderate').outdoorAllowed).toBe(true);
      expect(evaluateActivity('exercise', 'adult', 'Poor').outdoorAllowed).toBe(false);
      expect(evaluateActivity('exercise', 'adult', 'Very Poor').outdoorAllowed).toBe(false);
      expect(evaluateActivity('exercise', 'adult', 'Severe').outdoorAllowed).toBe(false);
    });

    it('allows sensitive groups outdoors only up to Satisfactory band', () => {
      const sensitiveGroups = ['child', 'elderly', 'sensitive', 'outdoor-worker'];

      for (const group of sensitiveGroups) {
        expect(evaluateActivity('play', group, 'Good').outdoorAllowed).toBe(true);
        expect(evaluateActivity('play', group, 'Satisfactory').outdoorAllowed).toBe(true);
        expect(evaluateActivity('play', group, 'Moderate').outdoorAllowed).toBe(false);
        expect(evaluateActivity('play', group, 'Poor').outdoorAllowed).toBe(false);
        expect(evaluateActivity('play', group, 'Severe').outdoorAllowed).toBe(false);
      }
    });
  });

  describe('Named Edge Case: Severe + child', () => {
    it('strictly forbids outdoor activity and mandates indoor isolation in filtered air', () => {
      const result = evaluateActivity('play', 'child', 'Severe');
      expect(result.outdoorAllowed).toBe(false);
      expect(result.actions).toContain('Strictly avoid all outdoor activities and playtime');
      expect(result.why.some((w) => w.includes('Severe band'))).toBe(true);
      expect(result.maskAdvice.toLowerCase()).toContain('consider a well-fitted n95');
    });
  });

  describe('Mask advice rules', () => {
    it('recommends well-fitted N95 when band >= Poor', () => {
      const poorResult = evaluateActivity('walk', 'adult', 'Poor');
      expect(poorResult.maskAdvice).toBe(
        'Consider a well-fitted N95 mask if outdoor activity is unavoidable.'
      );

      const severeResult = evaluateActivity('walk', 'adult', 'Severe');
      expect(severeResult.maskAdvice).toBe(
        'Consider a well-fitted N95 mask if outdoor activity is unavoidable.'
      );
    });

    it('does not require N95 mask when band < Poor', () => {
      const goodResult = evaluateActivity('walk', 'adult', 'Good');
      expect(goodResult.maskAdvice).not.toContain('well-fitted N95');

      const moderateResult = evaluateActivity('walk', 'adult', 'Moderate');
      expect(moderateResult.maskAdvice).not.toContain('well-fitted N95');
    });
  });

  describe('Indoor alternatives', () => {
    it('provides tailored alternatives for every supported activity', () => {
      const activities = ['walk', 'cycle', 'exercise', 'play', 'errands', 'commute'];
      for (const act of activities) {
        const evalRes = evaluateActivity(act, 'adult', 'Poor');
        expect(evalRes.indoorAlternative).toBe(INDOOR_ALTERNATIVES[act]);
        expect(evalRes.indoorAlternative.length).toBeGreaterThan(10);
      }
    });
  });
});
