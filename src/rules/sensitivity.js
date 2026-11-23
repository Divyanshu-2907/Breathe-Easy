export const SENSITIVITY_PROFILES = {
  child: {
    sensitivity: 'high',
    riskTier: 'high',
    isSensitiveGroup: true,
    label: 'child (<12)',
    description: 'Developing lungs and higher breathing volume per kg of body weight.',
  },
  teen: {
    sensitivity: 'moderate',
    riskTier: 'moderate',
    isSensitiveGroup: false,
    label: 'teen',
    description: 'Growing respiratory system; active sports and physical routines.',
  },
  adult: {
    sensitivity: 'standard',
    riskTier: 'standard',
    isSensitiveGroup: false,
    label: 'adult',
    description: 'Standard baseline adult biological susceptibility.',
  },
  elderly: {
    sensitivity: 'high',
    riskTier: 'high',
    isSensitiveGroup: true,
    label: 'elderly (60+)',
    description: 'Elevated cardiovascular and chronic pulmonary vulnerability.',
  },
  sensitive: {
    sensitivity: 'very high',
    riskTier: 'very high',
    isSensitiveGroup: true,
    label: 'sensitive (e.g. asthma)',
    description: 'Pre-existing conditions such as asthma, bronchitis, or allergies.',
  },
  'outdoor-worker': {
    sensitivity: 'high',
    riskTier: 'high',
    isSensitiveGroup: true,
    label: 'outdoor-worker',
    description: 'Extended cumulative daily exposure to ambient particulate matter.',
  },
};

/**
 * Returns the sensitivity profile for a given household member type.
 * @param {string} type
 * @returns {{ sensitivity: string, riskTier: string, isSensitiveGroup: boolean, description: string, label: string }}
 */
export function getMemberSensitivity(type) {
  const profile = SENSITIVITY_PROFILES[type];
  if (!profile) {
    return {
      sensitivity: 'standard',
      riskTier: 'standard',
      isSensitiveGroup: false,
      label: type || 'adult',
      description: 'Standard baseline adult biological susceptibility.',
    };
  }
  return profile;
}

/**
 * Returns true if the member type belongs to an elevated vulnerable/sensitive group.
 * @param {string} type
 * @returns {boolean}
 */
export function isSensitiveGroup(type) {
  return getMemberSensitivity(type).isSensitiveGroup;
}

export default {
  SENSITIVITY_PROFILES,
  getMemberSensitivity,
  isSensitiveGroup,
};
