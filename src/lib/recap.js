import { addDays, addMonths, formatMonth, hashKey, monthOf, parseKey, todayKey, weekKeys } from './dates.js';
import { topWords } from './words.js';
import { db } from './db.js';
import { moodById } from '../data/moods.js';

// Recaps are computed on demand from local data; nothing is stored or sent.

const short = (key, opts) => parseKey(key).toLocaleDateString(undefined, opts);

export function formatRange(start, end) {
  const sameMonth = monthOf(start) === monthOf(end);
  return `${short(start, { month: 'short', day: 'numeric' })} – ${
    sameMonth ? parseKey(end).getDate() : short(end, { month: 'short', day: 'numeric' })
  }`;
}

const monthEnd = (month) => addDays(`${addMonths(month, 1)}-01`, -1);

/** Completed Monday–Sunday weeks that have at least one entry, newest first. */
export function weekRanges(dates, today = todayKey()) {
  const thisMonday = weekKeys(today)[0];
  const starts = new Set(dates.map((d) => weekKeys(d)[0]).filter((m) => m < thisMonday));
  return [...starts]
    .sort()
    .reverse()
    .map((start) => ({ kind: 'week', start, end: addDays(start, 6) }));
}

/** Completed calendar months that have at least one entry, newest first. */
export function monthRanges(dates, today = todayKey()) {
  const current = monthOf(today);
  const months = new Set(dates.map(monthOf).filter((m) => m < current));
  return [...months]
    .sort()
    .reverse()
    .map((m) => ({ kind: 'month', start: `${m}-01`, end: monthEnd(m) }));
}

const TONE_RANK = { bright: 0, calm: 1, heavy: 2 };

/**
 * Mood ids in day order (nulls allowed) -> [{ mood, count }] most common first.
 * Ties lean gentle: brighter tone first, then the most recent day.
 */
export function rankMoods(ids) {
  const counts = new Map();
  const lastSeen = new Map();
  ids.forEach((id, i) => {
    if (!moodById(id)) return;
    counts.set(id, (counts.get(id) ?? 0) + 1);
    lastSeen.set(id, i);
  });
  return [...counts.entries()]
    .map(([id, count]) => ({ mood: moodById(id), count }))
    .sort(
      (a, b) =>
        b.count - a.count || TONE_RANK[a.mood.tone] - TONE_RANK[b.mood.tone] || lastSeen.get(b.mood.id) - lastSeen.get(a.mood.id),
    );
}

/** Streak as it stood at the end of a period (counting back from its last day). */
function streakAt(dateSet, end) {
  let cursor = dateSet.has(end) ? end : addDays(end, -1);
  let n = 0;
  while (dateSet.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

const firstText = (e) => {
  const t = (e.lines ?? []).find((l) => l.trim()) ?? e.prompt ?? '';
  return t.length > 110 ? `${t.slice(0, 107).trimEnd()}…` : t;
};

function seededPick(list, seed) {
  return list.length ? list[hashKey(seed) % list.length] : null;
}

export function recapId(range) {
  return `${range.kind}:${range.start}`;
}

/**
 * @param range { kind, start, end }
 * @param allEntries every entry (filtered here)
 * @param moodMap Map date -> mood id
 * @param allDates every date with an entry (for the streak)
 */
export function buildRecap(range, allEntries, moodMap, allDates) {
  const { kind, start, end } = range;
  const id = recapId(range);
  const entries = allEntries
    .filter((e) => e.date >= start && e.date <= end)
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));

  const dayKeys = [];
  for (let k = start; k <= end; k = addDays(k, 1)) dayKeys.push(k);
  const written = new Set(entries.map((e) => e.date));

  const moods = dayKeys.map((k) => moodById(moodMap.get(k)));
  const moodCounts = rankMoods(moods.map((m) => m?.id));

  const media = entries.flatMap((e) => e.mediaIds ?? []).slice(0, 9);

  // Favorite moment: a saved entry with media, else saved, else one with media, else any.
  const tiers = [
    entries.filter((e) => e.bookmarked && e.mediaIds?.length),
    entries.filter((e) => e.bookmarked),
    entries.filter((e) => e.mediaIds?.length),
    entries,
  ];
  const highlight = seededPick(tiers.find((t) => t.length) ?? [], id);

  return {
    id,
    kind,
    start,
    end,
    label: kind === 'week' ? formatRange(start, end) : formatMonth(monthOf(start)),
    noun: kind === 'week' ? 'week' : 'month',
    entries,
    dayKeys,
    written,
    daysCount: written.size,
    streak: streakAt(new Set(allDates), end),
    moods,
    moodCounts,
    primaryMood: moodCounts[0]?.mood ?? null,
    media,
    first: entries[0] ? { text: firstText(entries[0]), date: entries[0].date } : null,
    last: entries.length > 1 ? { text: firstText(entries.at(-1)), date: entries.at(-1).date } : null,
    words: topWords(entries, 28),
    highlight,
  };
}

/** Reads just what a recap needs from IndexedDB and builds it. */
export async function loadRecap(range) {
  const [entries, days, dates] = await Promise.all([
    db.entries.where('date').between(range.start, range.end, true, true).toArray(),
    db.days.where('date').between(range.start, range.end, true, true).toArray(),
    db.entries.orderBy('date').uniqueKeys(),
  ]);
  return buildRecap(range, entries, new Map(days.map((d) => [d.date, d.mood])), dates);
}

/** Last week's range (Mon–Sun), the one that becomes "ready" each Monday. */
export function lastWeekRange(today = todayKey()) {
  const start = addDays(weekKeys(today)[0], -7);
  return { kind: 'week', start, end: addDays(start, 6) };
}
