import { addDays, monthsBefore, todayKey } from './dates.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * "On this day" / "this week" memories from past months and years.
 * For each month back, use the exact same day if she wrote then, else the closest day within ±3.
 */
export function findFlashbacks(dates, today = todayKey(), limit = 8) {
  const set = new Set(dates);
  if (!set.size) return [];
  const oldest = [...set].sort()[0];
  const out = [];
  for (let k = 1; k <= 120; k++) {
    const target = monthsBefore(today, k);
    if (addDays(target, 3) < oldest) break;
    for (const off of [0, -1, 1, -2, 2, -3, 3]) {
      const date = addDays(target, off);
      if (!set.has(date)) continue;
      const span = k % 12 === 0 ? plural(k / 12, 'year') : plural(k, 'month');
      out.push({ date, exact: off === 0, k, label: off === 0 ? `${span} ago today` : `This week, ${span} ago` });
      break;
    }
  }
  // Exact "on this day" first, then most recent.
  return out.sort((a, b) => b.exact - a.exact || a.k - b.k).slice(0, limit);
}
