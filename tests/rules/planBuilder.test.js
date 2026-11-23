import { describe, it, expect } from 'vitest';
import { buildPlan } from '../../src/rules/planBuilder.js';
import { validatePlan } from '../../src/rules/guardrails.js';

describe('Rules: planBuilder.js', () => {
  const mockLocation = {
    name: 'Patna',
    country: 'India',
    lat: 25.6,
    lon: 85.12,
  };

  const mockAirQuality = {
    hourly: {
      time: Array.from({ length: 48 }, (_, i) => {
        const day = i < 24 ? '2026-11-23' : '2026-11-24';
        const hour = String(i % 24).padStart(2, '0');
        return `${day}T${hour}:00`;
      }),
      pm2_5: Array.from({ length: 48 }, (_, i) => {
        const hour = i % 24;
        if (hour >= 13 && hour <= 15) return 45; // Afternoon dip
        return 160; // Peak hours
      }),
    },
  };

  const mockRequest = {
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
        commuteMode: 'car',
      },
    ],
  };

  it('builds a complete, valid household air quality plan matching API contract', () => {
    const plan = buildPlan({
      location: mockLocation,
      airQuality: mockAirQuality,
      request: mockRequest,
    });

    // Top-level contract verification
    expect(plan.location).toEqual(mockLocation);
    expect(plan.forecastMeta.source).toBe('CAMS via Open-Meteo');
    expect(plan.forecastMeta.planDay).toBe('today');
    expect(plan.disclaimer).toBe(
      'Estimates from a city-level model forecast. Not medical advice.'
    );

    // Members verification
    expect(plan.protect.members).toHaveLength(2);
    const child = plan.protect.members[0];
    expect(child.name).toBe('Aarav');
    expect(child.type).toBe('child');
    expect(child.sensitivity).toBe('high');
    expect(child.riskTier).toBe('high');
    expect(child.usual.time).toBe('07:30');
    expect(child.recommended.window).toBe('13:00–14:00');
    expect(child.exposure).toHaveProperty('percentChange');
    expect(child.exposure).toHaveProperty('low');
    expect(child.exposure).toHaveProperty('high');
    expect(child.exposure.low).toBeLessThanOrEqual(child.exposure.percentChange);
    expect(child.exposure.percentChange).toBeLessThanOrEqual(child.exposure.high);

    // Ventilation verification
    expect(plan.indoor.ventilation).toHaveProperty('advice');
    expect(plan.indoor.ventilation).toHaveProperty('bestAiringHour');
    expect(plan.indoor.ventilation).toHaveProperty('why');

    // Swaps verification: each swap has source, and impactRange is omitted when null
    expect(plan.cut.swaps.length).toBeGreaterThan(0);
    for (const swap of plan.cut.swaps) {
      expect(swap).toHaveProperty('id');
      expect(swap).toHaveProperty('title');
      expect(swap).toHaveProperty('why');
      expect(swap).toHaveProperty('source');
      expect(swap.impactRange).toBeUndefined();
    }

    // Guardrail validation passes on the generated plan
    const guardrailCheck = validatePlan(plan, { request: mockRequest });
    expect(guardrailCheck.valid).toBe(true);
    expect(guardrailCheck.violations).toHaveLength(0);
  });
});
