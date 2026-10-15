import { addDays, todayKey } from './dates.js';

/**
 * Current streak counts back from today, or from yesterday if she hasn't written yet today,
 * so the number never "breaks" mid-day. Gentle by design.
 */
export function computeStreaks(dateKeys) {
  const days = new Set(dateKeys);
  const today = todayKey();
  let cursor = days.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  let best = 0;
  let run = 0;
  let prev = null;
  for (const key of [...days].sort()) {
    run = prev && addDays(prev, 1) === key ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }
  return { current, best, wroteToday: days.has(today), totalDays: days.size };
}

export const KIND_LINES = [
  'Consistency over perfection.',
  'Showing up is what matters.',
  'One small moment at a time.',
  'You made space for yourself today.',
  'Little by little, a little becomes a lot.',
  'Your heart is worth writing down.',
  'Gentle progress is still progress.',
];
