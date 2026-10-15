// Dates are stored as local "YYYY-MM-DD" keys so entries stay on the day she wrote them,
// whatever timezone she travels to.
const pad = (n) => String(n).padStart(2, '0');

export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => toKey(new Date());

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

const fmt = (key, opts) => parseKey(key).toLocaleDateString(undefined, opts);

/** "Thu, Oct 15" */
export const formatShort = (key) => fmt(key, { weekday: 'short', month: 'short', day: 'numeric' });
/** "Thursday, October 15" */
export const formatLong = (key) => fmt(key, { weekday: 'long', month: 'long', day: 'numeric' });
/** "Thu, Oct 15" plus the year when it isn't this year */
export function formatHeader(key) {
  const sameYear = key.slice(0, 4) === todayKey().slice(0, 4);
  return fmt(key, { weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function relativeLabel(key) {
  const t = todayKey();
  if (key === t) return 'Today';
  if (key === addDays(t, -1)) return 'Yesterday';
  return null;
}

/** Monday-first list of the 7 date keys in the week containing `key`. */
export function weekKeys(key = todayKey()) {
  const d = parseKey(key);
  const monday = addDays(key, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export const WEEKDAY_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** Stable small hash of a string, for picking "today's" prompt/affirmation. */
export function hashKey(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ---- Months ("YYYY-MM") ----
export const monthOf = (key) => key.slice(0, 7);

export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1, 12);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** "October 2026" */
export const formatMonth = (month) => parseKey(`${month}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** Monday-first weeks for a month; days outside the month are null. */
export function monthWeeks(month) {
  const first = parseKey(`${month}-01`);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`)];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

/** Same calendar day `n` months earlier, clamped to the month's length (Mar 31 -> Feb 28). */
export function monthsBefore(key, n) {
  const d = parseKey(key);
  const target = new Date(d.getFullYear(), d.getMonth() - n, 1, 12);
  const len = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), len));
  return toKey(target);
}
