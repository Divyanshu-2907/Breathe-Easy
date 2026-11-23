import { describe, it, expect } from 'vitest';
import {
  planRequestSchema,
  memberSchema,
  householdSchema,
  validatePlanRequest,
} from '../../src/validation/schemas.js';

describe('Validation Schemas', () => {
  const validRequest = {
    city: 'Patna',
    planDay: 'today',
    language: 'en',
    household: {
      cookingTimes: ['morning', 'evening'],
      cookingFuel: 'lpg',
      hasExhaust: true,
      hasPurifier: false,
    },
    members: [
      {
        name: 'Aarav',
        type: 'child',
        usualOutdoorTime: '07:30',
        outdoorMinutes: 60,
        activity: 'play',
      },
      {
        name: 'Sunita',
        type: 'adult',
        usualOutdoorTime: '08:30',
        outdoorMinutes: 45,
        activity: 'commute',
        commuteMode: 'two-wheeler',
      },
    ],
  };

  it('validates a complete valid plan request', () => {
    const result = validatePlanRequest(validRequest);
    expect(result.city).toBe('Patna');
    expect(result.members).toHaveLength(2);
  });

  describe('City validation', () => {
    it('accepts valid city formats with letters, dots, hyphens, and apostrophes', () => {
      const validCities = [
        'New Delhi',
        'St. Johns',
        'Kolkata-East',
        "O'Neill",
        'Patna',
      ];
      for (const city of validCities) {
        expect(() =>
          planRequestSchema.parse({ ...validRequest, city })
        ).not.toThrow();
      }
    });

    it('rejects city with script tags or HTML', () => {
      const malicious = '<script>alert(1)</script>';
      expect(() =>
        planRequestSchema.parse({ ...validRequest, city: malicious })
      ).toThrow();
    });

    it('rejects city with numbers', () => {
      expect(() =>
        planRequestSchema.parse({ ...validRequest, city: 'Delhi 123' })
      ).toThrow();
    });

    it('rejects city shorter than 2 chars', () => {
      expect(() =>
        planRequestSchema.parse({ ...validRequest, city: 'A' })
      ).toThrow();
    });

    it('rejects city longer than 60 chars', () => {
      const longCity = 'A'.repeat(61);
      expect(() =>
        planRequestSchema.parse({ ...validRequest, city: longCity })
      ).toThrow();
    });
  });

  describe('planDay & language validation', () => {
    it('accepts "today" and "tomorrow"', () => {
      expect(() =>
        planRequestSchema.parse({ ...validRequest, planDay: 'today' })
      ).not.toThrow();
      expect(() =>
        planRequestSchema.parse({ ...validRequest, planDay: 'tomorrow' })
      ).not.toThrow();
    });

    it('rejects invalid planDay', () => {
      expect(() =>
        planRequestSchema.parse({ ...validRequest, planDay: 'yesterday' })
      ).toThrow();
    });

    it('accepts "en" and "hi"', () => {
      expect(() =>
        planRequestSchema.parse({ ...validRequest, language: 'en' })
      ).not.toThrow();
      expect(() =>
        planRequestSchema.parse({ ...validRequest, language: 'hi' })
      ).not.toThrow();
    });

    it('rejects unsupported language', () => {
      expect(() =>
        planRequestSchema.parse({ ...validRequest, language: 'fr' })
      ).toThrow();
    });
  });

  describe('Strict rejection of unknown keys', () => {
    it('rejects unknown keys at root level', () => {
      expect(() =>
        planRequestSchema.parse({ ...validRequest, unexpectedKey: 'malicious' })
      ).toThrow();
    });

    it('rejects unknown keys inside household', () => {
      expect(() =>
        planRequestSchema.parse({
          ...validRequest,
          household: { ...validRequest.household, extraField: true },
        })
      ).toThrow();
    });

    it('rejects unknown keys inside members', () => {
      expect(() =>
        planRequestSchema.parse({
          ...validRequest,
          members: [{ ...validRequest.members[0], hacker: true }],
        })
      ).toThrow();
    });
  });

  describe('Members validation', () => {
    it('rejects empty members array (< 1 member)', () => {
      expect(() =>
        planRequestSchema.parse({ ...validRequest, members: [] })
      ).toThrow();
    });

    it('rejects > 8 members', () => {
      const nineMembers = Array.from({ length: 9 }, (_, i) => ({
        name: `Person ${i}`,
        type: 'adult',
        usualOutdoorTime: '07:00',
        outdoorMinutes: 30,
        activity: 'walk',
      }));
      expect(() =>
        planRequestSchema.parse({ ...validRequest, members: nineMembers })
      ).toThrow();
    });

    it('rejects script tags and symbols in member name', () => {
      const badNames = [
        '<script>alert(1)</script>',
        'User123',
        'John_Doe',
        'Alice@Home',
      ];
      for (const name of badNames) {
        expect(() =>
          memberSchema.parse({
            name,
            type: 'adult',
            usualOutdoorTime: '07:00',
            outdoorMinutes: 30,
            activity: 'walk',
          })
        ).toThrow();
      }
    });

    it('rejects name exceeding 30 characters', () => {
      expect(() =>
        memberSchema.parse({
          name: 'A'.repeat(31),
          type: 'adult',
          usualOutdoorTime: '07:00',
          outdoorMinutes: 30,
          activity: 'walk',
        })
      ).toThrow();
    });

    it('rejects bad HH:MM outdoor time strings', () => {
      const invalidTimes = [
        '24:00',
        '25:30',
        '12:60',
        '7:00',
        '07:0',
        'noon',
        '08:00 AM',
      ];
      for (const time of invalidTimes) {
        expect(() =>
          memberSchema.parse({
            name: 'Priya',
            type: 'adult',
            usualOutdoorTime: time,
            outdoorMinutes: 30,
            activity: 'walk',
          })
        ).toThrow();
      }
    });

    it('accepts valid HH:MM outdoor times', () => {
      const validTimes = ['00:00', '06:30', '12:00', '19:45', '23:59'];
      for (const time of validTimes) {
        expect(() =>
          memberSchema.parse({
            name: 'Priya',
            type: 'adult',
            usualOutdoorTime: time,
            outdoorMinutes: 30,
            activity: 'walk',
          })
        ).not.toThrow();
      }
    });

    it('rejects negative or > 240 outdoorMinutes', () => {
      expect(() =>
        memberSchema.parse({
          name: 'Priya',
          type: 'adult',
          usualOutdoorTime: '07:00',
          outdoorMinutes: -5,
          activity: 'walk',
        })
      ).toThrow();

      expect(() =>
        memberSchema.parse({
          name: 'Priya',
          type: 'adult',
          usualOutdoorTime: '07:00',
          outdoorMinutes: 241,
          activity: 'walk',
        })
      ).toThrow();

      expect(() =>
        memberSchema.parse({
          name: 'Priya',
          type: 'adult',
          usualOutdoorTime: '07:00',
          outdoorMinutes: 240,
          activity: 'walk',
        })
      ).not.toThrow();
    });

    it('rejects invalid member type', () => {
      expect(() =>
        memberSchema.parse({
          name: 'Priya',
          type: 'superhuman',
          usualOutdoorTime: '07:00',
          outdoorMinutes: 30,
          activity: 'walk',
        })
      ).toThrow();
    });

    it('validates all allowed member types and commute modes', () => {
      const types = [
        'child',
        'teen',
        'adult',
        'elderly',
        'sensitive',
        'outdoor-worker',
      ];
      for (const type of types) {
        expect(() =>
          memberSchema.parse({
            name: 'Member',
            type,
            usualOutdoorTime: '07:00',
            outdoorMinutes: 30,
            activity: 'commute',
            commuteMode: 'metro',
          })
        ).not.toThrow();
      }
    });
  });

  describe('Household validation', () => {
    it('rejects duplicate cooking times', () => {
      expect(() =>
        householdSchema.parse({
          cookingTimes: ['morning', 'morning'],
          cookingFuel: 'lpg',
          hasExhaust: true,
          hasPurifier: false,
        })
      ).toThrow();
    });

    it('rejects more than 3 cooking times', () => {
      expect(() =>
        householdSchema.parse({
          cookingTimes: ['morning', 'midday', 'evening', 'night'],
          cookingFuel: 'lpg',
          hasExhaust: true,
          hasPurifier: false,
        })
      ).toThrow();
    });

    it('rejects invalid cooking fuel', () => {
      expect(() =>
        householdSchema.parse({
          cookingTimes: ['morning'],
          cookingFuel: 'nuclear',
          hasExhaust: true,
          hasPurifier: false,
        })
      ).toThrow();
    });

    it('requires boolean flags for exhaust and purifier', () => {
      expect(() =>
        householdSchema.parse({
          cookingTimes: ['morning'],
          cookingFuel: 'lpg',
          hasExhaust: 'yes',
          hasPurifier: false,
        })
      ).toThrow();
    });
  });
});
