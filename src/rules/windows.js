import { getBand } from './bands.js';

/**
 * Finds the lowest-mean-PM2.5 contiguous window of N hours between 06:00 and 21:00
 * on the plan day, and evaluates the member's usual outdoor time.
 *
 * @param {object} forecast - Open-Meteo hourly air quality forecast
 * @param {string} planDay - "today" | "tomorrow"
 * @param {string} usualOutdoorTime - "HH:MM"
 * @param {number} outdoorMinutes - 0 to 240 minutes
 * @returns {object} { recommended: { window, start, end, pm25, band }, usual: { time, pm25, band } }
 */
export function findBestOutdoorWindow(
  forecast,
  planDay = 'today',
  usualOutdoorTime = '07:00',
  outdoorMinutes = 60
) {
  const defaultUsual = {
    time: usualOutdoorTime,
    pm25: 0,
    band: 'Good',
  };

  const defaultRecommended = {
    window: '06:00–07:00',
    start: '06:00',
    end: '07:00',
    pm25: 0,
    band: 'Good',
  };

  if (!forecast || !forecast.hourly || !Array.isArray(forecast.hourly.time)) {
    return { recommended: defaultRecommended, usual: defaultUsual };
  }

  const { time: times, pm2_5: pm25s } = forecast.hourly;
  if (times.length === 0 || !Array.isArray(pm25s) || pm25s.length === 0) {
    return { recommended: defaultRecommended, usual: defaultUsual };
  }

  // Identify dates
  const distinctDates = [...new Set(times.map((t) => t.slice(0, 10)))];
  const targetDate =
    planDay === 'tomorrow' && distinctDates.length > 1
      ? distinctDates[1]
      : distinctDates[0];

  // Map hourly slots for target date
  const daySlots = [];
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    if (t.slice(0, 10) === targetDate) {
      const hour = parseInt(t.slice(11, 13), 10);
      const pm25 = pm25s[i] ?? 0;
      daySlots.push({ hour, timeStr: `${String(hour).padStart(2, '0')}:00`, pm25 });
    }
  }

  if (daySlots.length === 0) {
    return { recommended: defaultRecommended, usual: defaultUsual };
  }

  // Filter slots strictly between 06:00 and 21:00 (hours 6 through 20)
  const windowSlots = daySlots
    .filter((slot) => slot.hour >= 6 && slot.hour <= 20)
    .sort((a, b) => a.hour - b.hour);

  // Compute duration in hours (min 1 hour, max 15)
  const hoursNeeded = Math.min(
    15,
    Math.max(1, Math.ceil((outdoorMinutes || 60) / 60))
  );

  // Determine usual outdoor time band & PM2.5
  let usualHour = 7;
  if (usualOutdoorTime && typeof usualOutdoorTime === 'string') {
    const parsedHour = parseInt(usualOutdoorTime.slice(0, 2), 10);
    if (!Number.isNaN(parsedHour)) {
      usualHour = parsedHour;
    }
  }

  const usualSlot =
    daySlots.find((s) => s.hour === usualHour) ||
    daySlots[Math.min(usualHour, daySlots.length - 1)];

  const usualPm25 = usualSlot ? Number(usualSlot.pm25) : 0;
  const usualEvaluation = {
    time: usualOutdoorTime,
    pm25: Math.round(usualPm25 * 10) / 10,
    band: getBand(usualPm25),
  };

  // If windowSlots has fewer hours than hoursNeeded (partial forecast), adjust window size
  const actualWindowSize = Math.max(1, Math.min(hoursNeeded, windowSlots.length));

  if (windowSlots.length === 0) {
    return {
      recommended: {
        window: '14:00–15:00',
        start: '14:00',
        end: '15:00',
        pm25: usualEvaluation.pm25,
        band: usualEvaluation.band,
      },
      usual: usualEvaluation,
    };
  }

  let bestMean = Infinity;
  let bestStartIndex = 0;

  for (let i = 0; i <= windowSlots.length - actualWindowSize; i++) {
    const slice = windowSlots.slice(i, i + actualWindowSize);
    const sum = slice.reduce((acc, curr) => acc + curr.pm25, 0);
    const mean = sum / slice.length;

    if (mean < bestMean) {
      bestMean = mean;
      bestStartIndex = i;
    }
  }

  const bestStartHour = windowSlots[bestStartIndex].hour;
  const bestEndHour = bestStartHour + actualWindowSize;

  const startStr = `${String(bestStartHour).padStart(2, '0')}:00`;
  const endStr = `${String(bestEndHour).padStart(2, '0')}:00`;
  const roundedPm25 = Math.round(bestMean * 10) / 10;

  return {
    recommended: {
      window: `${startStr}–${endStr}`,
      start: startStr,
      end: endStr,
      pm25: roundedPm25,
      band: getBand(roundedPm25),
    },
    usual: usualEvaluation,
  };
}

export default findBestOutdoorWindow;
