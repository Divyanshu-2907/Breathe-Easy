import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isAtLeastBand } from './bands.js';

const swapsPath = fileURLToPath(
  new URL('../../data/swaps.json', import.meta.url)
);
export const allSwaps = JSON.parse(fs.readFileSync(swapsPath, 'utf8'));

/**
 * Selects household swaps from data/swaps.json based on household context and current pollution band.
 *
 * @param {object} household - { cookingTimes, cookingFuel, hasExhaust, hasPurifier }
 * @param {string} band - 'Good'|'Satisfactory'|'Moderate'|'Poor'|'Very Poor'|'Severe'
 * @param {Array} members - array of household members
 * @returns {Array} Selected swaps formatted as { id, title, breatheLess, emitLess, impactLevel, impactRange, why }
 */
export function selectSwaps(household = {}, band = 'Moderate', members = []) {
  const cookingActive =
    (household.cookingTimes && household.cookingTimes.length > 0) ||
    household.hasExhaust === false;

  const usesSolidFuel =
    household.cookingFuel === 'solid-fuel' ||
    household.cookingFuel === 'mixed';

  const hasCarCommuter = members.some((m) => m.commuteMode === 'car');
  const hasMotorizedCommuter = members.some((m) =>
    ['car', 'two-wheeler', 'auto'].includes(m.commuteMode)
  );

  const isPeakSmog = isAtLeastBand(band, 'Poor');

  const selected = allSwaps.filter((swap) => {
    switch (swap.condition) {
      case 'solid-fuel':
        return usesSolidFuel;
      case 'commute-car':
        return hasCarCommuter;
      case 'commute-motorized':
        return hasMotorizedCommuter;
      case 'smog-peak':
        return isPeakSmog;
      case 'cooking':
        return cookingActive;
      case 'always':
      case 'ventilation':
      default:
        return true;
    }
  });

  return selected.map(
    ({ id, title, breatheLess, emitLess, impactLevel, impactRange, why }) => ({
      id,
      title,
      breatheLess,
      emitLess,
      impactLevel,
      impactRange: impactRange || 'Moderate reduction',
      why,
    })
  );
}

export default selectSwaps;
