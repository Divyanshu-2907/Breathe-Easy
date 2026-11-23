import { describe, it, expect } from 'vitest';
import { evaluateVentilation } from '../../src/rules/ventilation.js';

describe('Rules: ventilation.js', () => {
  const createForecast = (curve) => {
    const time = [];
    const pm2_5 = [];
    for (let h = 0; h < 24; h++) {
      time.push(`2026-11-23T${String(h).padStart(2, '0')}:00`);
      pm2_5.push(curve[h] ?? 120);
    }
    return { hourly: { time, pm2_5 } };
  };

  it('advises keeping windows closed and airing briefly for 10–15 min when band >= Poor', () => {
    const curve = Array(24).fill(150); // Very Poor
    curve[15] = 95; // dips at 15:00 (still Poor)

    const forecast = createForecast(curve);
    const result = evaluateVentilation(forecast, 'today', [], 'Very Poor');

    expect(result.advice).toContain('Keep windows closed');
    expect(result.advice).toContain('10–15 minutes');
    expect(result.bestAiringHour).toBe('15:00');
    expect(result.estimateNote).toContain('No indoor sensor data exists');
  });

  it('avoids cooking-smoke conflict hours when selecting the best airing hour', () => {
    const curve = Array(24).fill(150);
    // Hour 13:00 is mathematically lowest PM2.5
    curve[13] = 40;
    // Hour 15:00 is second lowest
    curve[15] = 50;

    const forecast = createForecast(curve);

    // Case 1: with midday cooking (conflict at hours 12, 13, 14)
    const resultWithConflict = evaluateVentilation(
      forecast,
      'today',
      ['midday'],
      'Very Poor'
    );
    expect(resultWithConflict.bestAiringHour).toBe('15:00');

    // Case 2: without midday cooking
    const resultNoConflict = evaluateVentilation(
      forecast,
      'today',
      [],
      'Very Poor'
    );
    expect(resultNoConflict.bestAiringHour).toBe('13:00');
  });

  it('permits open ventilation when pollution band is Good or Moderate', () => {
    const curve = Array(24).fill(45); // Satisfactory
    curve[14] = 20; // Good

    const forecast = createForecast(curve);
    const result = evaluateVentilation(forecast, 'today', [], 'Satisfactory');

    expect(result.advice).toContain('Natural ventilation is safe');
    expect(result.bestAiringHour).toBe('14:00');
  });

  it('handles empty or missing forecast with safe fallback', () => {
    const result = evaluateVentilation(null, 'today', ['morning']);
    expect(result.bestAiringHour).toBe('14:00');
    expect(result.estimateNote).toContain('No indoor sensor data exists');
  });
});
