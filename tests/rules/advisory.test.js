import { describe, it, expect } from 'vitest';
import { generateCommunityAdvisory } from '../../src/rules/advisory.js';

describe('Rules: advisory.js', () => {
  it('generates an advisory with collective actionable steps', () => {
    const advisory = generateCommunityAdvisory({
      city: 'Patna',
      band: 'Very Poor',
      bestPlayWindow: '14:00–15:00',
    });

    expect(advisory).toContain('Patna');
    expect(advisory).toContain('Very Poor');
    // SPEC requirements: actions like no leaf burning, carpool, best outdoor play window
    expect(advisory).toContain('Stop leaf and garbage burning tonight');
    expect(advisory).toContain('Carpool for school and office runs');
    expect(advisory).toContain('Best outdoor play window');
    expect(advisory).toContain('14:00–15:00');
  });

  it('adjusts actions for moderate or good air quality days', () => {
    const advisory = generateCommunityAdvisory({
      city: 'Ranchi',
      band: 'Satisfactory',
      bestPlayWindow: '15:00–16:00',
    });

    expect(advisory).toContain('Ranchi');
    expect(advisory).toContain('Satisfactory');
    expect(advisory).toContain('Best outdoor recreation window');
  });
});
