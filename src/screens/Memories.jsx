import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import MonthCalendar from '../components/MonthCalendar.jsx';
import { MediaImage } from '../components/Media.jsx';
import { CalendarIcon, MemoriesIcon, SearchIcon } from '../components/Icons.jsx';
import { db } from '../lib/db.js';
import { formatHeader, formatMonth, monthOf, parseKey, todayKey } from '../lib/dates.js';
import { findFlashbacks } from '../lib/flashbacks.js';
import { moodById } from '../data/moods.js';

const VIEW_KEY = 'glimmer.memoriesView';
const readView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) || 'grid';
  } catch {
    return 'grid';
  }
};

const matches = (e, q) => (e.prompt ?? '').toLowerCase().includes(q) || e.lines.some((l) => l.toLowerCase().includes(q));
const excerpt = (e) => e.lines.find((l) => l.trim()) ?? e.prompt ?? '';

export default function Memories({ onOpenDay }) {
  const entries = useLiveQuery(() => db.entries.toArray(), [], null);
  const dayRows = useLiveQuery(() => db.days.toArray(), [], []);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [view, setViewState] = useState(readView);
  const [month, setMonth] = useState(monthOf(todayKey()));

  const setView = (v) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* private mode */
    }
  };

  const moods = useMemo(() => new Map(dayRows.map((d) => [d.date, d.mood])), [dayRows]);

  // Every day's entries (oldest first, so the day's first photo leads its tile).
  const allByDate = useMemo(() => {
    const map = new Map();
    for (const e of [...(entries ?? [])].sort((a, b) => a.createdAt - b.createdAt)) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    }
    return map;
  }, [entries]);

  const q = query.trim().toLowerCase();
  const filtering = tab === 'saved' || !!q;
  const byDate = useMemo(() => {
    if (!filtering) return allByDate;
    const map = new Map();
    for (const [date, list] of allByDate) {
      const keep = list.filter((e) => (tab !== 'saved' || e.bookmarked) && (!q || matches(e, q)));
      if (keep.length) map.set(date, keep);
    }
    return map;
  }, [allByDate, filtering, tab, q]);

  const byMonth = useMemo(() => {
    const map = new Map();
    for (const date of [...byDate.keys()].sort().reverse()) {
      const m = monthOf(date);
      if (!map.has(m)) map.set(m, []);
      map.get(m).push(date);
    }
    return [...map.entries()];
  }, [byDate]);

  const flashbacks = useMemo(() => (filtering ? [] : findFlashbacks([...allByDate.keys()])), [allByDate, filtering]);

  const firstMedia = (date) => byDate.get(date)?.flatMap((e) => e.mediaIds ?? [])[0];
  const open = (date) => onOpenDay(date, filtering ? byDate.get(date).map((e) => e.id) : null);

  const total = entries?.length ?? 0;
  const savedCount = entries?.filter((e) => e.bookmarked).length ?? 0;
  const count = tab === 'saved' ? savedCount : total;

  return (
    <div className="screen memories">
      <header className="screen-head">
        <h1 className="serif">
          {count} {tab === 'saved' ? 'Saved' : count === 1 ? 'Memory' : 'Memories'}
        </h1>
        <button
          className="icon-btn view-toggle"
          onClick={() => setView(view === 'grid' ? 'calendar' : 'grid')}
          aria-label={view === 'grid' ? 'Show calendar' : 'Show grid'}
        >
          {view === 'grid' ? <CalendarIcon size={22} /> : <MemoriesIcon size={22} />}
        </button>
      </header>

      <div className="mem-controls">
        <div className="segmented wide" role="tablist">
          <button role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>
            All
          </button>
          <button role="tab" aria-selected={tab === 'saved'} className={tab === 'saved' ? 'on' : ''} onClick={() => setTab('saved')}>
            Saved
          </button>
        </div>
        <label className="search">
          <SearchIcon size={18} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search memories" enterKeyHint="search" />
        </label>
      </div>

      {flashbacks.length > 0 && view === 'grid' && (
        <section className="flashbacks">
          <h2 className="section-title serif">Flashbacks</h2>
          <div className="flash-scroll">
            {flashbacks.map((f) => {
              const list = allByDate.get(f.date);
              const media = list.flatMap((e) => e.mediaIds ?? [])[0];
              return (
                <button key={f.date} className={`flash-card ${media ? 'has-media' : ''}`} onClick={() => onOpenDay(f.date, null)}>
                  {media && <MediaImage id={media} lazy />}
                  <span className="flash-scrim" />
                  <span className="flash-label">{f.label}</span>
                  <span className="flash-text serif">{excerpt(list[0])}</span>
                  <span className="flash-date">{formatHeader(f.date)}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {view === 'calendar' ? (
        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          onDayClick={(date) => (byDate.has(date) ? open(date) : onOpenDay(date, null))}
          renderDay={(date) => {
            const has = byDate.has(date);
            const media = has && firstMedia(date);
            const mood = moodById(moods.get(date));
            return (
              <span className={`cal-cell ${has ? 'has' : ''} ${media ? 'has-media' : ''}`}>
                {media && <MediaImage id={media} lazy />}
                <span className="cal-num">{parseKey(date).getDate()}</span>
                {mood && !media && <span className="cal-mood">{mood.emoji}</span>}
              </span>
            );
          }}
          footer={
            <p className="muted small center cal-foot">
              {[...byDate.keys()].filter((d) => monthOf(d) === month).length} days with memories in {formatMonth(month).split(' ')[0]}
            </p>
          }
        />
      ) : (
        byMonth.map(([m, dates]) => (
          <section key={m} className="mem-month">
            <h2 className="section-title serif">{formatMonth(m)}</h2>
            <div className="mem-grid">
              {dates.map((date) => {
                const list = byDate.get(date);
                const media = firstMedia(date);
                const mood = moodById(moods.get(date));
                const d = parseKey(date);
                return (
                  <button key={date} className={`mem-tile ${media ? 'has-media' : ''}`} onClick={() => open(date)}>
                    {media ? (
                      <>
                        <MediaImage id={media} lazy />
                        <span className="tile-scrim" />
                        <span className="tile-date">
                          {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="tile-num serif">{d.getDate()}</span>
                        <span className="tile-sub">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                      </>
                    )}
                    {mood && <span className="tile-mood">{mood.emoji}</span>}
                    {list.length > 1 && <span className="tile-count">{list.length}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}

      {entries && byDate.size === 0 && view === 'grid' && (
        <div className="empty">
          <div className="empty-art">{q ? '🔎' : tab === 'saved' ? '🔖' : '📷'}</div>
          <p className="serif">
            {q ? 'No memories match that search.' : tab === 'saved' ? 'Nothing saved yet.' : 'Your memories will gather here.'}
          </p>
          <p className="muted small">
            {q ? 'Try another word.' : tab === 'saved' ? 'Tap Save on any entry to keep it here.' : 'Each day you write becomes a tile.'}
          </p>
        </div>
      )}
    </div>
  );
}
