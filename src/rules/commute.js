import { isAtLeastBand } from './bands.js';

export const EMISSION_RANKS = {
  walk: 0,
  cycle: 0,
  metro: 1,
  bus: 1,
  'e-rickshaw': 2,
  auto: 3,
  'two-wheeler': 3,
  car: 4,
};

/**
 * Generates low-emission commute suggestions strictly with emission rank <= current.
 *
 * Rules from SPEC:
 * - Suggest ONLY options with rank <= current (time shift first, then mode).
 * - Never suggest a higher-emission mode.
 * - If user drives: suggest carpool + cabin air recirculation.
 * - Walker gets time-shift before mode change.
 *
 * @param {string} currentMode - 'walk'|'cycle'|'metro'|'bus'|'e-rickshaw'|'auto'|'two-wheeler'|'car'
 * @param {string} band - current or forecast band
 * @param {string} cleanerWindow - optional cleanest window (e.g. "14:00–15:00")
 * @returns {object} Suggestions and advice
 */
export function evaluateCommute(currentMode = 'walk', band = 'Moderate', cleanerWindow = null) {
  const currentRank = EMISSION_RANKS[currentMode] ?? 0;
  const suggestions = [];
  const actions = [];
  const why = [];

  const timeShiftTarget = cleanerWindow ? `during the cleaner window (${cleanerWindow})` : 'away from morning/evening rush hours';

  // 1. Time shift recommendation ALWAYS comes first
  suggestions.push({
    type: 'time_shift',
    title: 'Shift commute timing',
    description: `Shift your departure ${timeShiftTarget} to avoid surface particulate peaks.`,
    rank: currentRank,
  });
  actions.push(`Shift commute timing ${timeShiftTarget}`);
  why.push('Traffic congestion and morning boundary-layer inversions multiply exposure during rush hours.');

  let cabinRecirculation = false;
  let carpoolSuggested = false;

  // 2. Specific mode logic
  if (currentMode === 'car') {
    cabinRecirculation = true;
    carpoolSuggested = true;

    suggestions.push({
      type: 'cabin_recirculation',
      title: 'Cabin air recirculation',
      description: 'Keep windows rolled up and switch air conditioner to internal recirculation to block exhaust plumes.',
      rank: currentRank,
    });
    actions.push('Keep car windows up and set AC to internal recirculation');

    suggestions.push({
      type: 'carpool',
      title: 'Carpool with colleagues or neighbors',
      description: 'Share your ride with 2–3 passengers to cut per-person emissions by up to 60%.',
      rank: 2,
    });
    actions.push('Organize or join a carpool for school/office trips');

    // Lower-emission transit modes (rank < 4)
    suggestions.push({
      type: 'mode_shift',
      title: 'Switch to Metro or Electric Bus',
      description: 'Opt for mass transit (metro or electric bus) for congested trunk corridors.',
      rank: 1,
    });
  } else if (currentMode === 'two-wheeler' || currentMode === 'auto') {
    // Rank 3: suggest rank <= 3 (metro=1, bus=1, e-rickshaw=2)
    suggestions.push({
      type: 'mode_shift',
      title: 'Switch to Metro or AC Bus',
      description: 'Choose enclosed metro or bus on high-traffic corridors to reduce direct roadside inhalation.',
      rank: 1,
    });
    suggestions.push({
      type: 'mode_shift',
      title: 'Opt for E-Rickshaw for first/last mile',
      description: 'Zero tailpipe emissions e-rickshaws reduce local neighborhood pollution.',
      rank: 2,
    });
    if (currentMode === 'two-wheeler' && isAtLeastBand(band, 'Poor')) {
      actions.push('Wear a fitted N95 respirator while riding in open traffic');
    }
  } else if (currentMode === 'metro' || currentMode === 'bus') {
    // Rank 1: already low emission, suggest rank 0 or 1
    suggestions.push({
      type: 'mode_shift',
      title: 'Combine with walking/cycling for last-mile',
      description: 'Walk or cycle for the last mile to maintain zero-emission end-to-end trips.',
      rank: 0,
    });
  } else if (currentMode === 'walk' || currentMode === 'cycle') {
    // Rank 0: already zero emission. Walker gets time-shift before mode change!
    // No mode upgrade is allowed (cannot suggest car, bus, etc. with rank > 0)
    suggestions.push({
      type: 'route_selection',
      title: 'Choose green or residential corridors',
      description: 'Navigate through quieter inner streets or parks 50+ meters away from high-traffic arterial roads.',
      rank: 0,
    });
    if (isAtLeastBand(band, 'Poor')) {
      actions.push('Consider wearing an N95 mask during prolonged walking/cycling');
    }
  }

  // Guardrail verification: ensure EVERY suggested item strictly has rank <= currentRank
  const validSuggestions = suggestions.filter((s) => s.rank <= currentRank);

  return {
    currentMode,
    currentRank,
    cabinRecirculation,
    carpoolSuggested,
    suggestions: validSuggestions,
    actions,
    why,
  };
}

export default evaluateCommute;
