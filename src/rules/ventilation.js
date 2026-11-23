import { getBand, isAtLeastBand } from './bands.js';

export const COOKING_HOURS = {
  morning: [7, 8, 9],
  midday: [12, 13, 14],
  evening: [19, 20, 21],
};

/**
 * Generates indoor ventilation recommendations based on outdoor forecast curve and cooking times.
 *
 * Rules from SPEC:
 * - No indoor sensor data exists (mark as estimate).
 * - When band >= Poor: keep windows closed and air briefly 10–15 min at cleanest forecast hour.
 * - Avoid airing during cooking-smoke time conflicts.
 *
 * @param {object} forecast - Open-Meteo forecast
 * @param {string} planDay - "today" | "tomorrow"
 * @param {string[]} cookingTimes - Array of 'morning' | 'midday' | 'evening'
 * @param {string} overallBand - Optional band override
 * @returns {object} { advice, bestAiringHour, why, estimateNote }
 */
export function evaluateVentilation(
  forecast,
  planDay = 'today',
  cookingTimes = [],
  overallBand = null
) {
  const estimateNote =
    'No indoor sensor data exists. Guidance is an estimate derived from city-level outdoor forecasts.';

  // Default fallback if forecast is missing
  const defaultHour = '14:00';
  if (!forecast || !forecast.hourly || !Array.isArray(forecast.hourly.time)) {
    return {
      advice:
        'Keep windows closed and air briefly for 10–15 minutes at the cleanest forecast hour (14:00).',
      bestAiringHour: defaultHour,
      why: 'Default guidance based on typical midday photochemical dilution. Mark as estimate.',
      estimateNote,
    };
  }

  const { time: times, pm2_5: pm25s } = forecast.hourly;
  const distinctDates = [...new Set(times.map((t) => t.slice(0, 10)))];
  const targetDate =
    planDay === 'tomorrow' && distinctDates.length > 1
      ? distinctDates[1]
      : distinctDates[0];

  const daySlots = [];
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    if (t.slice(0, 10) === targetDate) {
      const hour = parseInt(t.slice(11, 13), 10);
      const pm25 = pm25s[i] ?? 0;
      daySlots.push({ hour, pm25 });
    }
  }

  if (daySlots.length === 0) {
    return {
      advice:
        'Keep windows closed and air briefly for 10–15 minutes at the cleanest forecast hour (14:00).',
      bestAiringHour: defaultHour,
      why: 'No hourly slots found for target date; using typical afternoon airing window.',
      estimateNote,
    };
  }

  // Determine cooking conflict hours
  const conflictHours = new Set();
  for (const timeSlot of cookingTimes) {
    const hours = COOKING_HOURS[timeSlot] || [];
    for (const h of hours) {
      conflictHours.add(h);
    }
  }

  // Daytime hours suitable for airing (07:00 to 18:00)
  const daytimeSlots = daySlots.filter((s) => s.hour >= 7 && s.hour <= 18);
  const slotsToSearch = daytimeSlots.length > 0 ? daytimeSlots : daySlots;

  // Find cleanest hour avoiding cooking smoke conflicts
  const nonConflictingSlots = slotsToSearch.filter(
    (s) => !conflictHours.has(s.hour)
  );

  let bestSlot;
  if (nonConflictingSlots.length > 0) {
    bestSlot = nonConflictingSlots.reduce((prev, curr) =>
      curr.pm25 < prev.pm25 ? curr : prev
    );
  } else {
    // If every daytime slot conflicts, pick the overall cleanest
    bestSlot = slotsToSearch.reduce((prev, curr) =>
      curr.pm25 < prev.pm25 ? curr : prev
    );
  }

  const bestHourStr = `${String(bestSlot.hour).padStart(2, '0')}:00`;
  const effectiveBand = overallBand || getBand(bestSlot.pm25);
  const isSmoggy = isAtLeastBand(effectiveBand, 'Poor');

  let advice;
  let why;

  if (isSmoggy) {
    advice = `Keep windows closed throughout the day. Air briefly for 10–15 minutes at ${bestHourStr} when outdoor PM2.5 dips.`;
    why = `Ambient pollution is in the ${effectiveBand} band. Short airing at ${bestHourStr} flushes indoor CO2 and moisture while minimizing particulate infiltration, scheduled away from household cooking smoke.`;
  } else {
    advice = `Natural ventilation is safe. Open windows to refresh indoor air at ${bestHourStr}.`;
    why = `Forecast band is ${effectiveBand}. Afternoon thermal mixing provides cleaner outdoor air, scheduled to avoid cooking periods.`;
  }

  return {
    advice,
    bestAiringHour: bestHourStr,
    why,
    estimateNote,
  };
}

export default evaluateVentilation;
