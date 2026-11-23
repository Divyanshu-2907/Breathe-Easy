import { getBand } from './bands.js';
import { getMemberSensitivity } from './sensitivity.js';
import { findBestOutdoorWindow } from './windows.js';
import { evaluateActivity } from './activities.js';
import { evaluateCommute } from './commute.js';
import { evaluateVentilation } from './ventilation.js';
import { calculateRelativeExposure } from './exposure.js';
import { selectSwaps } from './swaps.js';
import { generateCommunityAdvisory } from './advisory.js';

export const DISCLAIMER_TEXT =
  'Estimates from a city-level model forecast. Not medical advice.';

/**
 * Builds the complete household air-quality plan response from deterministic rules.
 *
 * @param {object} params
 * @param {object} params.location - Geocoded location { name, country, lat, lon }
 * @param {object} params.airQuality - Hourly Open-Meteo air quality forecast
 * @param {object} params.request - Validated request body
 * @returns {object} Final plan response
 */
export function buildPlan({ location, airQuality, request }) {
  // Determine overall day band from forecast hourly pm2.5
  let dayOverallPm25 = 80;
  if (airQuality?.hourly?.pm2_5 && airQuality.hourly.pm2_5.length > 0) {
    const validPm25s = airQuality.hourly.pm2_5.filter((v) => typeof v === 'number');
    if (validPm25s.length > 0) {
      dayOverallPm25 =
        validPm25s.reduce((a, b) => a + b, 0) / validPm25s.length;
    }
  }
  const dayOverallBand = getBand(dayOverallPm25);

  let bestGlobalPlayWindow = '14:00–15:00';

  // Process household members
  const protectMembers = request.members.map((member) => {
    const sensitivity = getMemberSensitivity(member.type);
    const windowResult = findBestOutdoorWindow(
      airQuality,
      request.planDay,
      member.usualOutdoorTime,
      member.outdoorMinutes
    );

    if (member.type === 'child' || member.activity === 'play') {
      bestGlobalPlayWindow = windowResult.recommended.window;
    }

    const activityResult = evaluateActivity(
      member.activity,
      member.type,
      windowResult.recommended.band
    );

    const actions = [...activityResult.actions];
    const why = [...activityResult.why];

    // Commute guidance if applicable
    if (member.activity === 'commute' || member.commuteMode) {
      const commuteResult = evaluateCommute(
        member.commuteMode || 'walk',
        windowResult.recommended.band,
        windowResult.recommended.window
      );
      for (const act of commuteResult.actions) {
        if (!actions.includes(act)) {
          actions.push(act);
        }
      }
      for (const w of commuteResult.why) {
        if (!why.includes(w)) {
          why.push(w);
        }
      }
    }

    // Exposure calculation
    const exposure = calculateRelativeExposure({
      activity: member.activity,
      outdoorMinutes: member.outdoorMinutes,
      usualPm25: windowResult.usual.pm25,
      recommendedPm25: windowResult.recommended.pm25,
      outdoorAllowed: activityResult.outdoorAllowed,
      dayAveragePm25: dayOverallPm25,
    });

    return {
      name: member.name,
      type: member.type,
      sensitivity: sensitivity.sensitivity,
      riskTier: sensitivity.riskTier,
      usual: {
        time: windowResult.usual.time,
        band: windowResult.usual.band,
        pm25: windowResult.usual.pm25,
      },
      recommended: {
        window: windowResult.recommended.window,
        band: windowResult.recommended.band,
        pm25: windowResult.recommended.pm25,
      },
      actions,
      why,
      exposure,
    };
  });

  // Indoor ventilation
  const ventilationResult = evaluateVentilation(
    airQuality,
    request.planDay,
    request.household.cookingTimes,
    dayOverallBand
  );

  // Swaps
  const swaps = selectSwaps(request.household, dayOverallBand, request.members);

  // Community advisory
  const advisory = generateCommunityAdvisory({
    city: location.name,
    band: dayOverallBand,
    bestPlayWindow: bestGlobalPlayWindow,
  });

  return {
    location: {
      name: location.name,
      country: location.country,
      lat: location.lat,
      lon: location.lon,
    },
    forecastMeta: {
      source: 'CAMS via Open-Meteo',
      resolutionNote:
        '~25 km grid, 3-hourly forecast model (not street-level or real-time)',
      planDay: request.planDay,
      generatedAt: new Date().toISOString(),
    },
    protect: {
      members: protectMembers,
    },
    indoor: {
      ventilation: {
        advice: ventilationResult.advice,
        bestAiringHour: ventilationResult.bestAiringHour,
        why: ventilationResult.why,
      },
    },
    cut: {
      swaps,
    },
    community: {
      advisory,
    },
    explanation: {
      text: 'Household air-quality plan generated using deterministic CPCB breakpoint rules and Open-Meteo CAMS forecast data.',
      source: 'rules',
    },
    disclaimer: DISCLAIMER_TEXT,
  };
}

export default buildPlan;
