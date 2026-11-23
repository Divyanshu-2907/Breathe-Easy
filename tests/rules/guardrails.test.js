import { describe, it, expect } from 'vitest';
import { validatePlan, REQUIRED_DISCLAIMER } from '../../src/rules/guardrails.js';

describe('Rules: guardrails.js', () => {
  const createValidPassingPlan = () => ({
    location: {
      name: 'Patna',
      country: 'India',
      lat: 25.6,
      lon: 85.12,
    },
    forecastMeta: {
      source: 'CAMS via Open-Meteo',
      resolutionNote: '~25 km grid, 3-hourly forecast model',
      planDay: 'today',
      generatedAt: '2026-11-23T12:00:00.000Z',
    },
    protect: {
      members: [
        {
          name: 'Aarav',
          type: 'child',
          sensitivity: 'high',
          riskTier: 'high',
          usual: { time: '07:30', band: 'Poor', pm25: 110 },
          recommended: { window: '14:00–15:00', band: 'Satisfactory', pm25: 45 },
          actions: ['Shift outdoor play to 14:00–15:00'],
          why: ['Satisfactory air quality in the afternoon'],
          exposure: { percentChange: 35, low: 25, high: 45, note: 'Relative estimate' },
        },
      ],
    },
    indoor: {
      ventilation: {
        advice: 'Keep windows closed',
        bestAiringHour: '14:00',
        why: 'Cleanest hour',
      },
    },
    cut: {
      swaps: [
        {
          id: 'wet-mopping',
          title: 'Wet mop instead of dry sweeping',
          breatheLess: true,
          emitLess: false,
          impactLevel: 'low',
          why: 'Traps dust',
          source: 'NEEDS_SOURCE',
        },
      ],
    },
    community: {
      advisory: 'Stop leaf burning tonight. Carpool for school runs.',
    },
    explanation: {
      text: 'Rules-based plan',
      source: 'rules',
    },
    disclaimer: REQUIRED_DISCLAIMER,
  });

  it('PASSES a valid, compliant plan fixture', () => {
    const validPlan = createValidPassingPlan();
    const result = validatePlan(validPlan);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  describe('Required Fixture Failures from SPEC', () => {
    it('MUST FAIL fixture: sensitive member outdoors in Severe hour', () => {
      const plan = createValidPassingPlan();
      // Child recommended to be outdoors in Severe band
      plan.protect.members[0].recommended.band = 'Severe';
      plan.protect.members[0].actions = [
        'Outdoor sports and play recommended during this window',
      ];

      const result = validatePlan(plan);
      expect(result.valid).toBe(false);
      expect(
        result.violations.some((v) =>
          v.includes('outdoor activity recommendation during Severe pollution')
        )
      ).toBe(true);
    });

    it('MUST FAIL fixture: commute upgraded to car (higher emission mode)', () => {
      const plan = createValidPassingPlan();
      plan.protect.members[0].actions = [
        'Shift your commute and switch to car for your trips',
      ];

      const context = {
        request: {
          members: [
            {
              name: 'Aarav',
              type: 'child',
              commuteMode: 'walk', // Original rank 0
            },
          ],
        },
      };

      const result = validatePlan(plan, context);
      expect(result.valid).toBe(false);
      expect(
        result.violations.some((v) =>
          v.includes('upgraded from walk (rank 0) to higher-emission car (rank 4)')
        )
      ).toBe(true);
    });

    it('MUST FAIL fixture: unknown swap ID not found in data/swaps.json', () => {
      const plan = createValidPassingPlan();
      plan.cut.swaps.push({
        id: 'fake-unknown-swap-12345',
        title: 'Install solar spaceship',
        breatheLess: true,
        emitLess: true,
        impactLevel: 'high',
        why: 'Unknown',
        source: 'NEEDS_SOURCE',
      });

      const result = validatePlan(plan);
      expect(result.valid).toBe(false);
      expect(
        result.violations.some((v) => v.includes('Unknown swap ID "fake-unknown-swap-12345"'))
      ).toBe(true);
    });

    it('MUST FAIL fixture: missing required medical disclaimer', () => {
      const plan = createValidPassingPlan();
      delete plan.disclaimer;

      const result = validatePlan(plan);
      expect(result.valid).toBe(false);
      expect(
        result.violations.some((v) => v.includes('Missing or invalid required disclaimer'))
      ).toBe(true);
    });

    it('MUST FAIL fixture: exposure numbers without ranges or low > high', () => {
      const plan = createValidPassingPlan();
      plan.protect.members[0].exposure = {
        percentChange: 20,
        // missing low and high
      };

      const result = validatePlan(plan);
      expect(result.valid).toBe(false);
      expect(
        result.violations.some((v) =>
          v.includes('exposure estimates must include percentChange, low, and high')
        )
      ).toBe(true);
    });
  });
});
