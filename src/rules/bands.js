export const CPCB_LABEL =
  'CPCB PM2.5 breakpoints applied to hourly forecast values (approximate)';

export const BAND_NAMES = [
  'Good',
  'Satisfactory',
  'Moderate',
  'Poor',
  'Very Poor',
  'Severe',
];

const BAND_RANKS = {
  Good: 0,
  Satisfactory: 1,
  Moderate: 2,
  Poor: 3,
  'Very Poor': 4,
  Severe: 5,
};

/**
 * Returns the CPCB band for a given PM2.5 concentration (in µg/m³).
 * Breakpoints:
 *   Good: 0–30
 *   Satisfactory: 31–60
 *   Moderate: 61–90
 *   Poor: 91–120
 *   Very Poor: 121–250
 *   Severe: >250
 *
 * @param {number} pm25 - PM2.5 in µg/m³
 * @returns {string} The band name
 */
export function getBand(pm25) {
  const value = Number(pm25);
  if (Number.isNaN(value) || value <= 30) {
    return 'Good';
  }
  if (value <= 60) {
    return 'Satisfactory';
  }
  if (value <= 90) {
    return 'Moderate';
  }
  if (value <= 120) {
    return 'Poor';
  }
  if (value <= 250) {
    return 'Very Poor';
  }
  return 'Severe';
}

/**
 * Returns numeric rank of a band (0 for Good up to 5 for Severe)
 */
export function getBandRank(band) {
  return BAND_RANKS[band] ?? 0;
}

/**
 * Checks whether bandA is worse than or equal to bandB
 */
export function isAtLeastBand(currentBand, thresholdBand) {
  return getBandRank(currentBand) >= getBandRank(thresholdBand);
}

export default {
  CPCB_LABEL,
  BAND_NAMES,
  getBand,
  getBandRank,
  isAtLeastBand,
};
