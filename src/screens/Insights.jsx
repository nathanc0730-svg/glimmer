import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import MonthCalendar from '../components/MonthCalendar.jsx';
import { ChevronRight, SparkleIcon } from '../components/Icons.jsx';
import { db, useSetting } from '../lib/db.js';
import { formatMonth, monthOf, parseKey, todayKey } from '../lib/dates.js';
import { computeStreaks } from '../lib/streak.js';
import { formatRange, monthRanges, rankMoods, recapId, weekRanges } from '../lib/recap.js';
import { topLines, topWords } from '../lib/words.js';
import { moodById } from '../data/moods.js';

function Stat({ emoji, value, label }) {
  return (
    <div className="stat">
      <span className="stat-emoji">{emoji}</span>
      <span className="stat-value serif">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function RecapRow({ range, label, summary, seen, onOpen }) {
  return (
    <button className="recap-row" onClick={() => onOpen(range)}>
      <span className="recap-row-emoji">{summary.mood?.emoji ?? '✨'}</span>
      <span className="recap-row-text">
        <span className="recap-row-title">
          {label}
          {!seen && <span className="new-dot" aria-label="New" />}
        </span>
        <span className="muted small">
          {summary.days} {summary.days === 1 ? 'day' : 'days'} journaled
        </span>
      </span>
      <ChevronRight size={18} />
    </button>
  );
}

export default function Insights({ onOpenRecap }) {
  const entries = useLiveQuery(() => db.entries.toArray(), [], null);
  const dayRows = useLiveQuery(() => db.days.toArray(), [], []);
  const [seen] = useSetting('seenRecaps', []);
  const [month, setMonth] = useState(monthOf(todayKey()));
  const [scope, setScope] = useState('month');
  const [showAllWeeks, setShowAllWeeks] = useState(false);

  const moodMap = useMemo(() => new Map(dayRows.map((d) => [d.date, d.mood])), [dayRows]);
  const dates = useMemo(() => [...new Set((entries ?? []).map((e) => e.date))].sort(), [entries]);
  const stats = computeStreaks(dates);
  const weeks = useMemo(() => weekRanges(dates), [dates]);
  const months = useMemo(() => monthRanges(dates), [dates]);

  const summarize = (range) => {
    const inRange = dates.filter((d) => d >= range.start && d <= range.end);
    const ids = dayRows
      .filter((d) => d.date >= range.start && d.date <= range.end)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((d) => d.mood);
    const top = rankMoods(ids)[0];
    return { days: inRange.length, mood: top?.mood ?? null };
  };

  const monthMoods = useMemo(() => {
    const ids = dayRows
      .filter((d) => monthOf(d.date) === month)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((d) => d.mood);
    return rankMoods(ids);
  }, [dayRows, month]);

  const scoped = useMemo(
    () => (scope === 'month' ? (entries ?? []).filter((e) => monthOf(e.date) === month) : (entries ?? [])),
    [entries, scope, month],
  );
  const words = useMemo(() => topWords(scoped, 15), [scoped]);
  const lines = useMemo(() => topLines(scoped, 5), [scoped]);

  if (!entries) return <div className="screen" />;
  const latest = weeks[0];
  const latestDays = latest ? summarize(latest).days : 0;
  const monthName = formatMonth(month).split(' ')[0];

  return (
    <div className="screen insights">
      <header className="screen-head">
        <h1 className="serif">Insights</h1>
      </header>

      {latest ? (
        <button className="card gradient-card recap-hero" onClick={() => onOpenRecap(latest)}>
          <div className="eyebrow">
            <SparkleIcon size={12} /> {seen.includes(recapId(latest)) ? 'Weekly recap' : 'Your weekly recap is ready'}
          </div>
          <p className="serif prompt-big">
            {latestDays} {latestDays === 1 ? 'day' : 'days'} of little moments
          </p>
          <div className="recap-hero-foot">
            <span>{formatRange(latest.start, latest.end)}</span>
            <span className="today-go-inline">
              Watch <ChevronRight size={16} />
            </span>
          </div>
        </button>
      ) : (
        <div className="card soft-card">
          <div className="eyebrow muted">
            <SparkleIcon size={12} /> Weekly recap
          </div>
          <p className="serif soft-text">Your first weekly recap will be ready on Monday.</p>
        </div>
      )}

      <div className="stat-grid">
        <Stat emoji="🔥" value={stats.current} label="Current streak" />
        <Stat emoji="⭐" value={stats.best} label="Best streak" />
        <Stat emoji="✍️" value={entries.length} label="Total entries" />
        <Stat emoji="📅" value={stats.totalDays} label="Days journaled" />
      </div>

      <h2 className="section-title serif">Mood calendar</h2>
      <MonthCalendar
        month={month}
        onMonthChange={setMonth}
        renderDay={(date) => {
          const mood = moodById(moodMap.get(date));
          return (
            <span className={`cal-cell mood-cell ${mood ? 'has-mood' : ''}`} style={mood ? { background: `${mood.color}26` } : undefined}>
              {mood ? <span className="cal-emoji">{mood.emoji}</span> : <span className="cal-num">{parseKey(date).getDate()}</span>}
            </span>
          );
        }}
        footer={
          <div className="mood-breakdown">
            {monthMoods.length === 0 ? (
              <p className="muted small center">No moods logged in {monthName} yet.</p>
            ) : (
              monthMoods.map(({ mood, count }) => (
                <div key={mood.id} className="mood-bar">
                  <span className="mood-emoji-sm">{mood.emoji}</span>
                  <span className="mood-bar-label small">{mood.label}</span>
                  <span className="bar">
                    <span style={{ width: `${(count / monthMoods[0].count) * 100}%`, background: mood.color }} />
                  </span>
                  <span className="small">{count}</span>
                </div>
              ))
            )}
          </div>
        }
      />

      <div className="section-row">
        <h2 className="section-title serif">Your words</h2>
        <div className="segmented small-seg">
          <button className={scope === 'month' ? 'on' : ''} onClick={() => setScope('month')}>
            {monthName}
          </button>
          <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>
            All time
          </button>
        </div>
      </div>
      <div className="card">
        <div className="eyebrow muted">Most frequent words</div>
        {words.length ? (
          <div className="word-chips">
            {words.map((w, i) => (
              <span key={w.word} className={`word-chip c${i % 6}`}>
                {w.word} <b>{w.count}</b>
              </span>
            ))}
          </div>
        ) : (
          <p className="muted small top-gap">Your most-used words will appear as you write.</p>
        )}
        <div className="eyebrow muted top-gap-lg">Most frequent lines</div>
        {lines.length ? (
          <ol className="freq-lines">
            {lines.map((l) => (
              <li key={l.text}>
                <span className="serif">{l.text}</span>
                <span className="muted small">×{l.count}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted small top-gap">Lines you write more than once will show up here.</p>
        )}
      </div>

      {weeks.length > 0 && (
        <>
          <h2 className="section-title serif">Weekly recaps</h2>
          <div className="card list-card">
            {(showAllWeeks ? weeks : weeks.slice(0, 5)).map((w) => (
              <RecapRow
                key={w.start}
                range={w}
                label={formatRange(w.start, w.end)}
                summary={summarize(w)}
                seen={seen.includes(recapId(w))}
                onOpen={onOpenRecap}
              />
            ))}
            {weeks.length > 5 && (
              <button className="btn-text show-all" onClick={() => setShowAllWeeks(!showAllWeeks)}>
                {showAllWeeks ? 'Show fewer' : `Show all ${weeks.length}`}
              </button>
            )}
          </div>
        </>
      )}

      {months.length > 0 && (
        <>
          <h2 className="section-title serif">Monthly recaps</h2>
          <div className="card list-card">
            {months.map((m) => (
              <RecapRow
                key={m.start}
                range={m}
                label={formatMonth(monthOf(m.start))}
                summary={summarize(m)}
                seen={seen.includes(recapId(m))}
                onOpen={onOpenRecap}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

