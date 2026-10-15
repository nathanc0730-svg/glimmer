import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import EntryCard from '../components/EntryCard.jsx';
import { BookmarkIcon, CheckIcon, ChevronRight, SparkleIcon } from '../components/Icons.jsx';
import { db, entryDates, getSetting, recentEntries, setSetting, useSetting } from '../lib/db.js';
import { dailyAffirmationIndex, dailyPrompt } from '../lib/daily.js';
import { addDays, formatHeader, formatLong, greeting, relativeLabel, todayKey } from '../lib/dates.js';
import { computeStreaks } from '../lib/streak.js';
import { formatRange, lastWeekRange, recapId } from '../lib/recap.js';
import { backupDue } from '../lib/backup.js';
import { shouldInstall } from '../lib/platform.js';
import { AFFIRMATIONS } from '../data/affirmations.js';
import { moodById } from '../data/moods.js';

export function StreakPill({ dates }) {
  const { current } = computeStreaks(dates ?? []);
  return (
    <div className={`streak-pill ${current ? '' : 'zero'}`} aria-label={`${current} day streak`}>
      <span>🔥</span>
      {current}
    </div>
  );
}

export default function Home({ onWrite, onPick, onOpenEntry, onMood, onOpenRecap, onGoSettings, onShowInstall }) {
  const today = todayKey();
  const prompts = useLiveQuery(() => db.prompts.toArray(), [], []);
  const dates = useLiveQuery(entryDates, [], []);
  const recent = useLiveQuery(() => recentEntries(60), [], null);
  const dayRows = useLiveQuery(() => db.days.toArray(), [], []);
  const [dailyOn] = useSetting('dailyPrompt', true);
  const [saved, setSaved] = useSetting('savedAffirmations', []);
  // undefined while loading, so the card never flashes for a recap she has already seen
  const seenRecaps = useLiveQuery(() => getSetting('seenRecaps', []), []);
  const lastWeek = lastWeekRange(today);
  const [needsBackup, setNeedsBackup] = useState(false);
  useEffect(() => {
    backupDue().then(setNeedsBackup);
  }, [dates.length]);
  const snoozeBackup = () => {
    setSetting('backupSnoozeUntil', addDays(today, 3));
    setNeedsBackup(false);
  };
  const recapReady =
    !!seenRecaps && !seenRecaps.includes(recapId(lastWeek)) && dates.some((d) => d >= lastWeek.start && d <= lastWeek.end);

  const todays = dailyOn ? dailyPrompt(prompts, today) : null;
  const wroteToday = dates.includes(today);
  const affIndex = dailyAffirmationIndex(today);
  const affSaved = saved.includes(affIndex);
  const moods = useMemo(() => new Map(dayRows.map((d) => [d.date, moodById(d.mood)])), [dayRows]);
  const todayMood = moods.get(today);

  const groups = useMemo(() => {
    const map = new Map();
    for (const e of recent ?? []) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    }
    for (const list of map.values()) list.sort((a, b) => b.createdAt - a.createdAt);
    return [...map.entries()];
  }, [recent]);

  return (
    <div className="screen home">
      <header className="screen-head">
        <div>
          <div className="eyebrow muted">{formatLong(today)}</div>
          <h1 className="serif">{greeting()}</h1>
        </div>
        <StreakPill dates={dates} />
      </header>

      <section
        className="card gradient-card today-card"
        role="button"
        tabIndex={0}
        onClick={() => (todays ? onWrite(todays) : onPick())}
      >
        <div className="eyebrow">
          <SparkleIcon size={12} /> {todays ? 'Today’s prompt' : 'Today'}
        </div>
        <p className="serif prompt-big">{todays ? todays.text : 'What’s on your heart today?'}</p>
        <div className="today-foot">
          <span className={`today-status ${wroteToday ? 'done' : ''}`}>
            {wroteToday ? (
              <>
                <CheckIcon size={14} /> Journaled today
              </>
            ) : (
              'Whenever you’re ready'
            )}
          </span>
          <button
            className={`today-mood ${todayMood ? 'set' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onMood(today);
            }}
          >
            {todayMood ? (
              <>
                <span className="mood-emoji-sm">{todayMood.emoji}</span> {todayMood.label}
              </>
            ) : (
              '+ Add today’s mood'
            )}
          </button>
          <span className="today-go" aria-hidden="true">
            <ChevronRight size={18} />
          </span>
        </div>
      </section>

      {shouldInstall() && (
        <button className="card install-banner" onClick={onShowInstall}>
          <span className="recap-ready-icon">📲</span>
          <span>
            <span className="recap-ready-title serif">Add Glimmer to your Home Screen</span>
            <span className="muted small">So your iPhone keeps your journal safe</span>
          </span>
          <ChevronRight size={18} />
        </button>
      )}

      {recapReady && (
        <button className="card recap-ready" onClick={() => onOpenRecap(lastWeek)}>
          <span className="recap-ready-icon">✨</span>
          <span>
            <span className="recap-ready-title serif">Your weekly recap is ready</span>
            <span className="muted small">{formatRange(lastWeek.start, lastWeek.end)} · tap to look back</span>
          </span>
          <ChevronRight size={18} />
        </button>
      )}

      {needsBackup && (
        <section className="card backup-nudge">
          <div className="serif backup-title">It’s been a little while since your last backup</div>
          <p className="muted small">A quick copy to iCloud Drive keeps your memories safe if anything happens to this phone.</p>
          <div className="row-end">
            <button className="btn-text" onClick={snoozeBackup}>
              Later
            </button>
            <button className="btn-small" onClick={onGoSettings}>
              Back up now
            </button>
          </div>
        </section>
      )}

      <section className="card affirmation-card">
        <div className="affirmation-head">
          <div className="eyebrow muted">Daily affirmation</div>
          <button
            className={`icon-btn small ${affSaved ? 'on' : ''}`}
            aria-label={affSaved ? 'Remove bookmark' : 'Bookmark affirmation'}
            onClick={() => setSaved(affSaved ? saved.filter((i) => i !== affIndex) : [...saved, affIndex])}
          >
            <BookmarkIcon size={19} filled={affSaved} />
          </button>
        </div>
        <p className="serif affirmation-text">{AFFIRMATIONS[affIndex]}</p>
      </section>

      <h2 className="section-title serif">Recent entries</h2>
      {recent && groups.length === 0 && (
        <div className="empty">
          <div className="empty-art">✨</div>
          <p className="serif">Your first little moment is waiting.</p>
          <p className="muted small">Tap the + below to pick a prompt and start.</p>
        </div>
      )}
      {groups.map(([date, list]) => (
        <section key={date} className="day-group">
          <div className="day-head">
            <h3 className="serif">{formatHeader(date)}</h3>
            {moods.get(date) && (
              <span className="day-mood" title={moods.get(date).label}>
                {moods.get(date).emoji}
              </span>
            )}
            {relativeLabel(date) && <span className="muted small">{relativeLabel(date)}</span>}
          </div>
          {list.map((e) => (
            <EntryCard key={e.id} entry={e} onOpen={onOpenEntry} />
          ))}
        </section>
      ))}
    </div>
  );
}
