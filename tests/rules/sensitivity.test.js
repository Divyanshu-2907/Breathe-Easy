import { describe, it, expect } from 'vitest';
import {
  getMemberSensitivity,
  isSensitiveGroup,
  SENSITIVITY_PROFILES,
} from '../../src/rules/sensitivity.js';

describe('Rules: sensitivity.js', () => {
  it('correctly maps child (<12) to high sensitivity and sensitive group', () => {
    const profile = getMemberSensitivity('child');
    expect(profile.sensitivity).toBe('high');
    expect(profile.riskTier).toBe('high');
    expect(profile.isSensitiveGroup).toBe(true);
    expect(isSensitiveGroup('child')).toBe(true);
  });

  it('correctly maps teen to moderate sensitivity', () => {
    const profile = getMemberSensitivity('teen');
    expect(profile.sensitivity).toBe('moderate');
    expect(profile.riskTier).toBe('moderate');
    expect(profile.isSensitiveGroup).toBe(false);
  });

  it('correctly maps adult to standard sensitivity', () => {
    const profile = getMemberSensitivity('adult');
    expect(profile.sensitivity).toBe('standard');
    expect(profile.riskTier).toBe('standard');
    expect(profile.isSensitiveGroup).toBe(false);
  });

  it('correctly maps elderly (60+) to high sensitivity', () => {
    const profile = getMemberSensitivity('elderly');
    expect(profile.sensitivity).toBe('high');
    expect(profile.riskTier).toBe('high');
    expect(profile.isSensitiveGroup).toBe(true);
  });

  it('correctly maps sensitive (e.g. asthma) to very high sensitivity', () => {
    const profile = getMemberSensitivity('sensitive');
    expect(profile.sensitivity).toBe('very high');
    expect(profile.riskTier).toBe('very high');
    expect(profile.isSensitiveGroup).toBe(true);
  });

  it('correctly maps outdoor-worker to high sensitivity', () => {
    const profile = getMemberSensitivity('outdoor-worker');
    expect(profile.sensitivity).toBe('high');
    expect(profile.riskTier).toBe('high');
    expect(profile.isSensitiveGroup).toBe(true);
  });

  it('falls back safely for unknown member types', () => {
    const profile = getMemberSensitivity('unknown-type');
    expect(profile.sensitivity).toBe('standard');
    expect(profile.isSensitiveGroup).toBe(false);
  });

  it('contains entries for all 6 required member types', () => {
    const requiredTypes = [
      'child',
      'teen',
      'adult',
      'elderly',
      'sensitive',
      'outdoor-worker',
    ];
    for (const type of requiredTypes) {
      expect(SENSITIVITY_PROFILES).toHaveProperty(type);
    }
  });
});
