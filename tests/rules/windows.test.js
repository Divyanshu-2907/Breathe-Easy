import { describe, it, expect } from 'vitest';
import { findBestOutdoorWindow } from '../../src/rules/windows.js';

describe('Rules: windows.js', () => {
  const createMockForecast = (todayCurve, tomorrowCurve) => {
    const time = [];
    const pm2_5 = [];

    // 24 hours today
    for (let h = 0; h < 24; h++) {
      time.push(`2026-11-23T${String(h).padStart(2, '0')}:00`);
      pm2_5.push(todayCurve[h] ?? 100);
    }
    // 24 hours tomorrow
    for (let h = 0; h < 24; h++) {
      time.push(`2026-11-24T${String(h).padStart(2, '0')}:00`);
      pm2_5.push(tomorrowCurve ? tomorrowCurve[h] ?? 100 : 100);
    }

    return { hourly: { time, pm2_5 } };
  };

  it('finds lowest-mean-PM2.5 window in the afternoon dip', () => {
    // Typical smog pattern: peak morning, lowest 14:00–16:00, peak evening
    const curve = Array(24).fill(150);
    curve[14] = 35; // lowest
    curve[15] = 40;

    const forecast = createMockForecast(curve);
    const result = findBestOutdoorWindow(forecast, 'today', '07:00', 60);

    expect(result.recommended.window).toBe('14:00–15:00');
    expect(result.recommended.pm25).toBe(35);
    expect(result.recommended.band).toBe('Satisfactory');
    expect(result.usual.time).toBe('07:00');
    expect(result.usual.pm25).toBe(150);
    expect(result.usual.band).toBe('Very Poor');
  });

  it('handles window at start of day edge (06:00)', () => {
    const curve = Array(24).fill(120);
    curve[6] = 25; // Cleanest right at 06:00

    const forecast = createMockForecast(curve);
    const result = findBestOutdoorWindow(forecast, 'today', '08:00', 60);

    expect(result.recommended.window).toBe('06:00–07:00');
    expect(result.recommended.pm25).toBe(25);
    expect(result.recommended.band).toBe('Good');
  });

  it('handles window at end of day edge (20:00–21:00)', () => {
    const curve = Array(24).fill(180);
    curve[20] = 45; // Cleanest at 20:00 (ends at 21:00)

    const forecast = createMockForecast(curve);
    const result = findBestOutdoorWindow(forecast, 'today', '07:00', 60);

    expect(result.recommended.window).toBe('20:00–21:00');
    expect(result.recommended.pm25).toBe(45);
    expect(result.recommended.band).toBe('Satisfactory');
  });

  it('calculates multi-hour contiguous windows correctly', () => {
    const curve = Array(24).fill(200);
    curve[13] = 50;
    curve[14] = 60;
    curve[15] = 70; // 13:00 to 15:00 avg = 55, 14:00 to 16:00 avg = 60 + 70 + 200...

    const forecast = createMockForecast(curve);
    // 120 minutes -> 2 hours
    const result = findBestOutdoorWindow(forecast, 'today', '07:00', 120);

    expect(result.recommended.window).toBe('13:00–15:00');
    expect(result.recommended.pm25).toBe(55);
    expect(result.recommended.band).toBe('Satisfactory');
  });

  it('correctly targets "tomorrow" when requested', () => {
    const todayCurve = Array(24).fill(100);
    todayCurve[14] = 40;

    const tomorrowCurve = Array(24).fill(250);
    tomorrowCurve[11] = 20; // Best tomorrow is at 11:00

    const forecast = createMockForecast(todayCurve, tomorrowCurve);
    const result = findBestOutdoorWindow(forecast, 'tomorrow', '07:00', 60);

    expect(result.recommended.window).toBe('11:00–12:00');
    expect(result.recommended.pm25).toBe(20);
    expect(result.recommended.band).toBe('Good');
  });

  it('handles empty forecast gracefully without throwing', () => {
    const result = findBestOutdoorWindow(null, 'today', '07:00', 60);
    expect(result).toHaveProperty('recommended');
    expect(result).toHaveProperty('usual');
    expect(result.recommended.band).toBe('Good');
  });

  it('handles partial forecast with few available hours', () => {
    // Only 2 hours available in the day
    const partialForecast = {
      hourly: {
        time: ['2026-11-23T06:00', '2026-11-23T07:00'],
        pm2_5: [80, 65],
      },
    };

    const result = findBestOutdoorWindow(partialForecast, 'today', '06:00', 120);
    expect(result.recommended.window).toBeDefined();
    expect(result.recommended.pm25).toBeGreaterThan(0);
  });
});
