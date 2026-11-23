import { isAtLeastBand } from './bands.js';

/**
 * Generates an actionable community advisory bulletin with specific collective actions.
 *
 * SPEC requirement:
 * community advisory text with ACTIONS (e.g. no leaf/garbage burning tonight,
 * carpool for school run, best outdoor play window), not just warnings.
 *
 * @param {object} params
 * @param {string} params.city - City name
 * @param {string} params.band - Forecast air quality band
 * @param {string} [params.bestPlayWindow] - Cleanest daytime outdoor window (e.g. "14:00–15:00")
 * @returns {string} Advisory text
 */
export function generateCommunityAdvisory({
  city = 'Local Area',
  band = 'Moderate',
  bestPlayWindow = '14:00–15:00',
}) {
  const isSevereOrPoor = isAtLeastBand(band, 'Poor');

  const lines = [
    `Community Air Action Advisory for ${city} (Forecast Band: ${band}):`,
    '',
    '1. Stop leaf and garbage burning tonight: Ground-level smoldering spreads concentrated PM2.5 and toxic smoke directly into neighbor bedrooms.',
    '2. Carpool for school and office runs: Coordinate with neighbors to share drop-offs and switch engines off while waiting at school gates.',
  ];

  if (isSevereOrPoor) {
    lines.push(
      `3. Best outdoor play window: Outdoor activities for children must be restricted to ${bestPlayWindow} or moved indoors; keep classroom and living-room windows closed during morning/evening commute peaks.`
    );
    lines.push(
      '4. Protect outdoor workers and security staff: Provide clean drinking water, encourage shift rotations away from heavy traffic corridors, and distribute well-fitted N95 masks.'
    );
  } else {
    lines.push(
      `3. Best outdoor recreation window: Plan sports, park visits, and outdoor play around ${bestPlayWindow} when boundary-layer mixing dilutes surface pollutants.`
    );
    lines.push(
      '4. Keep streets and entryways clean: Wet-mop common building corridors and place doormats at building entrances to trap street particulate matter.'
    );
  }

  return lines.join('\n');
}

export default generateCommunityAdvisory;
