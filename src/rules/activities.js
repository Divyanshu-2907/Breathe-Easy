import { isSensitiveGroup } from './sensitivity.js';
import { isAtLeastBand } from './bands.js';

export const INDOOR_ALTERNATIVES = {
  exercise: 'Indoor yoga, bodyweight circuit, or stationary cycling',
  play: 'Indoor building blocks, board games, or active living-room obstacle play',
  walk: 'Walking in indoor corridors, enclosed mall, or light indoor pacing',
  cycle: 'Indoor stationary bike or spinning workout',
  errands: 'Consolidate errands, use doorstep delivery, or shift to cleaner afternoon window',
  commute: 'Commute with closed vehicle windows, cabin recirculation ON, or wear an N95 mask',
};

/**
 * Evaluates activity safety, mask requirements, and indoor alternatives.
 *
 * Rule from SPEC:
 * Outdoor exercise allowed? (adults up to Moderate, sensitive groups up to Satisfactory)
 * Mask advice "consider a well-fitted N95" when band >= Poor.
 *
 * @param {string} activity - 'walk'|'cycle'|'exercise'|'play'|'errands'|'commute'
 * @param {string} memberType - 'child'|'teen'|'adult'|'elderly'|'sensitive'|'outdoor-worker'
 * @param {string} band - 'Good'|'Satisfactory'|'Moderate'|'Poor'|'Very Poor'|'Severe'
 * @returns {object} { outdoorAllowed, maskAdvice, indoorAlternative, actions: string[], why: string[] }
 */
export function evaluateActivity(activity, memberType, band) {
  const isSensitive = isSensitiveGroup(memberType);
  const bandRankAtLeastPoor = isAtLeastBand(band, 'Poor');

  // Strenuous outdoor physical exertion allowed?
  let outdoorAllowed = true;
  if (isSensitive) {
    // Sensitive groups allowed outdoors only up to Satisfactory
    if (isAtLeastBand(band, 'Moderate')) {
      outdoorAllowed = false;
    }
  } else {
    // Adults / standard groups allowed up to Moderate
    if (isAtLeastBand(band, 'Poor')) {
      outdoorAllowed = false;
    }
  }

  // Mask advice
  let maskAdvice =
    'Mask generally not required for brief outdoor exposure at this forecast band.';
  if (bandRankAtLeastPoor) {
    maskAdvice = 'Consider a well-fitted N95 mask if outdoor activity is unavoidable.';
  }

  // Alternative
  const indoorAlternative =
    INDOOR_ALTERNATIVES[activity] || 'Light indoor activities with windows shut';

  // Actions and Why explanations
  const actions = [];
  const why = [];

  if (band === 'Severe' && memberType === 'child') {
    actions.push('Strictly avoid all outdoor activities and playtime');
    actions.push('Keep child indoors in a sealed room with air filtration if possible');
    why.push(
      'Air quality is in the Severe band (>250 µg/m³ PM2.5); children inhale more air per kg of body weight, posing acute respiratory risks.'
    );
  } else if (!outdoorAllowed) {
    actions.push(`Shift ${activity} indoors: ${indoorAlternative}`);
    if (bandRankAtLeastPoor) {
      actions.push(maskAdvice);
    }
    why.push(
      `${memberType === 'adult' ? 'Adults' : 'Vulnerable individuals'} should avoid strenuous outdoor activity when air quality reaches ${band}.`
    );
  } else {
    actions.push(`Outdoor ${activity} is acceptable during the cleanest recommended window`);
    if (bandRankAtLeastPoor) {
      actions.push(maskAdvice);
    }
    why.push(
      `Forecast band is ${band}, which permits moderate outdoor routines for ${memberType}.`
    );
  }

  return {
    outdoorAllowed,
    maskAdvice,
    indoorAlternative,
    actions,
    why,
  };
}

export default evaluateActivity;
