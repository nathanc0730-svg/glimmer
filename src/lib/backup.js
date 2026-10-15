import { db, entryDates, getSetting } from './db.js';
import { addDays, todayKey } from './dates.js';

// Backups are a plain .zip: journal.json (entries, moods, custom prompts, a few preferences)
// plus every photo/video as an ordinary file. She chooses where it goes via the share sheet.

const FORMAT = 'glimmer-backup';
const VERSION = 1;
const KEEP_SETTINGS = ['dailyPrompt', 'savedAffirmations', 'seenRecaps'];

const EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-m4v': 'm4v',
};
const extFor = (type) => EXT[type] ?? 'bin';

const README = `Glimmer journal backup

journal.json  - your entries, daily moods and custom prompts
media/        - your photos and videos

To restore: open Glimmer > Settings > Import backup, and pick this .zip file.
`;

/** Builds the backup zip. `onProgress(done, total)` reports media files processed. */
export async function buildBackup(onProgress) {
  const { Zip, ZipDeflate, ZipPassThrough, strToU8 } = await import('fflate');
  const parts = [];
  let resolveZip;
  let rejectZip;
  const finished = new Promise((res, rej) => {
    resolveZip = res;
    rejectZip = rej;
  });
  const zip = new Zip((err, chunk, final) => {
    if (err) return rejectZip(err);
    parts.push(chunk);
    if (final) resolveZip();
  });
  const add = (name, data, compress = false) => {
    const file = compress ? new ZipDeflate(name, { level: 6 }) : new ZipPassThrough(name);
    zip.add(file);
    file.push(data, true);
  };

  const [entries, days, prompts, settings] = await Promise.all([
    db.entries.toArray(),
    db.days.toArray(),
    db.prompts.toArray(),
    db.settings.toArray(),
  ]);
  const mediaIds = [...new Set(entries.flatMap((e) => e.mediaIds ?? []))];

  // Media one at a time (already compressed, so stored as-is) to keep memory steady.
  const media = [];
  for (let i = 0; i < mediaIds.length; i++) {
    const m = await db.media.get(mediaIds[i]);
    if (!m?.blob) continue;
    const file = `media/${m.id}.${extFor(m.blob.type)}`;
    add(file, new Uint8Array(await m.blob.arrayBuffer()));
    let thumb = null;
    if (m.thumbBlob && m.thumbBlob !== m.blob) {
      thumb = `media/${m.id}-thumb.jpg`;
      add(thumb, new Uint8Array(await m.thumbBlob.arrayBuffer()));
    }
    const { blob, thumbBlob, ...meta } = m;
    media.push({ ...meta, file, mime: blob.type, thumb });
    onProgress?.(i + 1, mediaIds.length);
  }

  const journal = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    counts: { entries: entries.length, days: days.length, media: media.length },
    entries,
    days,
    prompts: prompts.filter((p) => p.custom || p.favorite),
    settings: settings.filter((s) => KEEP_SETTINGS.includes(s.key)),
    media,
  };
  add('journal.json', strToU8(JSON.stringify(journal, null, 1)), true);
  add('README.txt', strToU8(README), true);
  zip.end();
  await finished;

  const name = `glimmer-backup-${todayKey()}.zip`;
  return new File(parts, name, { type: 'application/zip' });
}

/** Unzips and validates a backup file. Returns a summary plus what `restoreBackup` needs. */
export async function readBackup(file) {
  const { unzip, strFromU8 } = await import('fflate');
  const buf = new Uint8Array(await file.arrayBuffer());
  const files = await new Promise((res, rej) => unzip(buf, (err, data) => (err ? rej(err) : res(data))));
  // Tolerate a zip that was re-compressed with an extra top folder (e.g. by the Files app).
  const jsonPath = Object.keys(files).find((p) => p.endsWith('journal.json'));
  if (!jsonPath) throw new Error('This doesn’t look like a Glimmer backup.');
  const prefix = jsonPath.slice(0, -'journal.json'.length);
  const journal = JSON.parse(strFromU8(files[jsonPath]));
  if (journal.format !== FORMAT) throw new Error('This doesn’t look like a Glimmer backup.');
  return { journal, files, prefix };
}

/** Merges a backup into this phone. Entries with the same id are updated; nothing is deleted. */
export async function restoreBackup({ journal, files, prefix }) {
  await db.transaction('rw', [db.entries, db.days, db.prompts, db.settings, db.media], async () => {
    for (const m of journal.media ?? []) {
      const data = files[prefix + m.file];
      if (!data) continue;
      const { file, mime, thumb, ...meta } = m;
      const blob = new Blob([data], { type: mime });
      const thumbData = thumb ? files[prefix + thumb] : null;
      const thumbBlob = thumbData ? new Blob([thumbData], { type: 'image/jpeg' }) : meta.type === 'image' ? blob : null;
      await db.media.put({ ...meta, blob, thumbBlob });
    }
    await db.entries.bulkPut(journal.entries ?? []);
    await db.days.bulkPut(journal.days ?? []);
    for (const p of journal.prompts ?? []) {
      if (p.custom) await db.prompts.put(p);
      else await db.prompts.update(p.id, { favorite: true });
    }
    await db.settings.bulkPut(journal.settings ?? []);
  });
}

/** Gentle nudge once it's been 2+ weeks since the last backup (or since she started). */
export async function backupDue() {
  const [last, snooze, first] = await Promise.all([
    getSetting('lastBackupAt', null),
    getSetting('backupSnoozeUntil', null),
    entryDates().then((dates) => (dates.length ? { date: dates[0] } : null)),
  ]);
  if (!first) return false;
  const today = todayKey();
  if (snooze && snooze > today) return false;
  const since = last ? last.slice(0, 10) : first.date;
  return addDays(since, 14) <= today;
}

export async function storageInfo() {
  const est = (await navigator.storage?.estimate?.()) ?? {};
  const persisted = (await navigator.storage?.persisted?.()) ?? false;
  return { usage: est.usage ?? null, quota: est.quota ?? null, persisted };
}

export function formatBytes(n) {
  if (n == null) return '—';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
