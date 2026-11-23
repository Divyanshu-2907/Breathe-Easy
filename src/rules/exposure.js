import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Load assumptions file safely
const assumptionsPath = fileURLToPath(
  new URL('../../data/assumptions.json', import.meta.url)
);
const assumptions = JSON.parse(fs.readFileSync(assumptionsPath, 'utf8'));

/**
 * Calculates a relative PM2.5 exposure reduction estimate comparing usual vs recommended schedule.
 *
 * Rule from SPEC:
 * RELATIVE estimate only: sum(PM2.5 × hours × inhalationMultiplier(activity) × microenvironmentFactor(indoor/outdoor))
 * for USUAL schedule vs RECOMMENDED schedule -> percentChange (rounded, returned with a low/high range using assumption ranges).
 * No absolute health claims.
 * Edge case: exposure range always has low <= value <= high.
 *
 * @param {object} params
 * @param {string} params.activity - e.g. 'walk', 'exercise', 'play', 'cycle', 'commute', 'errands'
 * @param {number} params.outdoorMinutes - e.g. 60
 * @param {number} params.usualPm25 - PM2.5 at usual time (µg/m³)
 * @param {number} params.recommendedPm25 - PM2.5 at recommended window (µg/m³)
 * @param {boolean} params.outdoorAllowed - whether outdoor activity was allowed at recommended window
 * @param {number} [params.dayAveragePm25] - optional ambient day background PM2.5
 * @returns {object} { percentChange, low, high, note }
 */
export function calculateRelativeExposure({
  activity = 'walk',
  outdoorMinutes = 60,
  usualPm25 = 100,
  recommendedPm25 = 50,
  outdoorAllowed = true,
  dayAveragePm25 = null,
}) {
  const note =
    'Relative exposure reduction estimate based on forecast PM2.5 and activity multipliers. Not medical advice.';

  const outdoorHours = Math.max(0, Math.min(24, (outdoorMinutes || 0) / 60));
  const indoorHours = Math.max(0, 24 - outdoorHours);
  const baselineDayPm25 =
    dayAveragePm25 ?? (usualPm25 + recommendedPm25) / 2;

  const actKey = assumptions.inhalationMultipliers[activity]
    ? activity
    : 'walk';
  const actInhale = assumptions.inhalationMultipliers[actKey];
  const restInhale = assumptions.inhalationMultipliers.rest;

  const outdoorEnv = assumptions.microenvironments.outdoor;
  const indoorEnv = assumptions.microenvironments['indoor-windows-closed'];

  // Helper to compute daily exposure given specific parameter sets (value, low, or high)
  const computeDailyExposure = (paramType) => {
    const inhaleAct = actInhale[paramType];
    const inhaleRest = restInhale[paramType];
    const envOutdoor = outdoorEnv[paramType];
    const envIndoor = indoorEnv[paramType];

    // Usual schedule: outdoors at usual time + indoors remaining time
    const usualOutdoorExp = usualPm25 * outdoorHours * inhaleAct * envOutdoor;
    const usualIndoorExp =
      baselineDayPm25 * indoorHours * inhaleRest * envIndoor;
    const usualTotal = usualOutdoorExp + usualIndoorExp;

    // Recommended schedule:
    // If outdoor activity was shifted indoors because of pollution, indoor factor applies during that time
    let recOutdoorExp;
    if (outdoorAllowed) {
      recOutdoorExp = recommendedPm25 * outdoorHours * inhaleAct * envOutdoor;
    } else {
      recOutdoorExp =
        baselineDayPm25 * outdoorHours * inhaleAct * envIndoor;
    }
    const recIndoorExp =
      baselineDayPm25 * indoorHours * inhaleRest * envIndoor;
    const recTotal = recOutdoorExp + recIndoorExp;

    if (usualTotal <= 0) return 0;
    const reduction = ((usualTotal - recTotal) / usualTotal) * 100;
    return reduction;
  };

  const rawValue = computeDailyExposure('value');
  const rawLow = computeDailyExposure('low');
  const rawHigh = computeDailyExposure('high');

  const roundedValue = Math.round(rawValue);
  const roundedLow = Math.round(rawLow);
  const roundedHigh = Math.round(rawHigh);

  // Guarantee invariant: low <= percentChange <= high
  const candidates = [roundedValue, roundedLow, roundedHigh];
  const minBound = Math.min(...candidates);
  const maxBound = Math.max(...candidates);

  return {
    percentChange: roundedValue,
    low: minBound,
    high: maxBound,
    note,
  };
}

export default calculateRelativeExposure;
