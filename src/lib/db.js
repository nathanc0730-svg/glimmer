import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { SEED_PROMPTS } from '../data/prompts.js';

// Everything lives in this one on-device IndexedDB database. Nothing is ever sent anywhere.
export const db = new Dexie('glimmer');

db.version(1).stores({
  entries: 'id, date, createdAt', // {id, date, createdAt, updatedAt, prompt, promptId, lines[], mode, mediaIds[], bookmarked}
  media: 'id, createdAt', // {id, type: 'image'|'video', blob, thumbBlob, width, height, duration, createdAt}
  days: 'date', // {date, mood}
  prompts: 'id, category', // {id, text, category, custom, favorite}
  settings: 'key', // {key, value}
});

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Adds any built-in prompts the database doesn't have yet (first run, or new prompts in an app update)
// without touching her favorites or custom prompts.
export async function syncSeedPrompts() {
  const existing = new Set((await db.prompts.toArray()).map((p) => p.id));
  const missing = SEED_PROMPTS.filter((p) => !existing.has(p.id));
  if (missing.length) await db.prompts.bulkAdd(missing);
}

export async function getSetting(key, fallback) {
  const row = await db.settings.get(key);
  return row ? row.value : fallback;
}

export const setSetting = (key, value) => db.settings.put({ key, value });

export function useSetting(key, fallback) {
  const value = useLiveQuery(() => db.settings.get(key).then((r) => (r ? r.value : fallback)), [key], fallback);
  return [value, (v) => setSetting(key, v)];
}

export async function saveEntry(entry) {
  const now = Date.now();
  const row = { bookmarked: false, createdAt: now, ...entry, id: entry.id ?? uid(), updatedAt: now };
  await db.entries.put(row);
  return row;
}

export async function deleteEntry(id) {
  await db.transaction('rw', db.entries, db.media, async () => {
    const entry = await db.entries.get(id);
    if (!entry) return;
    await db.media.bulkDelete(entry.mediaIds ?? []);
    await db.entries.delete(id);
  });
}

// Reads below always load the whole table and sort in JavaScript. Some iPhones fail sorted or
// ranged index reads ("UnknownError: Unable to open cursor") while plain whole-table reads work,
// and a journal is small enough that this costs nothing noticeable.
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt ?? 0) - (b.createdAt ?? 0));

/** Sorted, unique dates that have at least one entry. */
export async function entryDates() {
  return [...new Set((await db.entries.toArray()).map((e) => e.date))].sort();
}

/** The newest entries first. */
export async function recentEntries(limit) {
  return (await db.entries.toArray()).sort(byDate).reverse().slice(0, limit);
}

/** Entries written on one day, oldest first. */
export async function entriesOn(date) {
  return (await db.entries.toArray()).filter((e) => e.date === date).sort(byDate);
}

/** Rows whose date falls in [start, end], from a table keyed or indexed by date. */
export async function rowsBetween(table, start, end) {
  return (await table.toArray()).filter((r) => r.date >= start && r.date <= end);
}

export const entryHasContent = (e) =>
  (e.lines ?? []).some((l) => l.trim()) || (e.mediaIds ?? []).length > 0;
