import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Sheet from './Sheet.jsx';
import { db } from '../lib/db.js';
import { formatShort, todayKey } from '../lib/dates.js';
import { MOODS } from '../data/moods.js';

/** `request` = { date } or null. Calls onDone() after a choice, skip, or close. */
export default function MoodSheet({ request, onDone }) {
  return (
    <Sheet open={!!request} onClose={onDone} label="Mood of the day" z={65}>
      {request && <MoodBody key={request.date} date={request.date} onDone={onDone} />}
    </Sheet>
  );
}

function MoodBody({ date, onDone }) {
  const day = useLiveQuery(() => db.days.get(date), [date]);
  const [picked, setPicked] = useState(null);
  const current = picked ?? day?.mood ?? null;
  const isToday = date === todayKey();

  const choose = async (id) => {
    setPicked(id);
    await db.days.put({ date, mood: id, skipped: false });
    setTimeout(onDone, 260); // let the selection glow register before closing
  };

  const skip = async () => {
    // Remember the skip so she isn't asked again after her next entry today.
    if (!day) await db.days.put({ date, mood: null, skipped: true });
    onDone();
  };

  const clear = async () => {
    await db.days.put({ date, mood: null, skipped: true });
    onDone();
  };

  return (
    <div className="sheet-scroll mood-body">
      <h2 className="serif mood-title">{isToday ? 'How was your day overall?' : `How was ${formatShort(date)}?`}</h2>
      <p className="muted small center">One mood for the whole day. You can always change it.</p>
      <div className="mood-grid">
        {MOODS.map((m) => (
          <button
            key={m.id}
            className={`mood-btn ${current === m.id ? 'on' : ''}`}
            style={{ '--mood': m.color }}
            onClick={() => choose(m.id)}
            aria-pressed={current === m.id}
          >
            <span className="mood-emoji">{m.emoji}</span>
            <span className="mood-label">{m.label}</span>
          </button>
        ))}
      </div>
      {day?.mood ? (
        <button className="btn-text mood-skip" onClick={clear}>
          Remove mood
        </button>
      ) : (
        <button className="btn-text mood-skip" onClick={skip}>
          Skip for today
        </button>
      )}
    </div>
  );
}
