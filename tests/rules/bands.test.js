import { describe, it, expect } from 'vitest';
import {
  getBand,
  getBandRank,
  isAtLeastBand,
  CPCB_LABEL,
  BAND_NAMES,
} from '../../src/rules/bands.js';

describe('Rules: bands.js', () => {
  it('exports the required CPCB breakpoint label', () => {
    expect(CPCB_LABEL).toBe(
      'CPCB PM2.5 breakpoints applied to hourly forecast values (approximate)'
    );
  });

  it('correctly classifies Good band (0–30)', () => {
    expect(getBand(0)).toBe('Good');
    expect(getBand(15)).toBe('Good');
    expect(getBand(30)).toBe('Good');
  });

  it('correctly classifies boundary between Good and Satisfactory (30/31)', () => {
    expect(getBand(30)).toBe('Good');
    expect(getBand(30.1)).toBe('Satisfactory');
    expect(getBand(31)).toBe('Satisfactory');
  });

  it('correctly classifies boundary between Satisfactory and Moderate (60/61)', () => {
    expect(getBand(60)).toBe('Satisfactory');
    expect(getBand(60.1)).toBe('Moderate');
    expect(getBand(61)).toBe('Moderate');
  });

  it('correctly classifies boundary between Moderate and Poor (90/91)', () => {
    expect(getBand(90)).toBe('Moderate');
    expect(getBand(90.1)).toBe('Poor');
    expect(getBand(91)).toBe('Poor');
  });

  it('correctly classifies boundary between Poor and Very Poor (120/121)', () => {
    expect(getBand(120)).toBe('Poor');
    expect(getBand(120.1)).toBe('Very Poor');
    expect(getBand(121)).toBe('Very Poor');
  });

  it('correctly classifies boundary between Very Poor and Severe (250/251)', () => {
    expect(getBand(250)).toBe('Very Poor');
    expect(getBand(250.1)).toBe('Severe');
    expect(getBand(251)).toBe('Severe');
    expect(getBand(500)).toBe('Severe');
  });

  it('handles negative or NaN values safely as Good', () => {
    expect(getBand(-5)).toBe('Good');
    expect(getBand(null)).toBe('Good');
    expect(getBand(undefined)).toBe('Good');
  });

  it('correctly ranks bands and compares thresholds', () => {
    expect(getBandRank('Good')).toBe(0);
    expect(getBandRank('Severe')).toBe(5);

    expect(isAtLeastBand('Poor', 'Poor')).toBe(true);
    expect(isAtLeastBand('Very Poor', 'Poor')).toBe(true);
    expect(isAtLeastBand('Moderate', 'Poor')).toBe(false);
  });

  it('contains all 6 standard CPCB band names', () => {
    expect(BAND_NAMES).toEqual([
      'Good',
      'Satisfactory',
      'Moderate',
      'Poor',
      'Very Poor',
      'Severe',
    ]);
  });
});
