import { useLiveQuery } from 'dexie-react-hooks';
import Sheet from './Sheet.jsx';
import EntryCard from './EntryCard.jsx';
import { CloseIcon, PenIcon } from './Icons.jsx';
import { db } from '../lib/db.js';
import { formatLong, relativeLabel } from '../lib/dates.js';
import { moodById } from '../data/moods.js';

/** All entries for one day (optionally only `onlyIds`), the day's mood, and a way to write for that day. */
export default function DaySheet({ request, onClose, onOpenEntry, onWrite, onMood }) {
  return (
    <Sheet open={!!request} onClose={onClose} label="Day" className="day-sheet">
      {request && <DayBody {...request} onClose={onClose} onOpenEntry={onOpenEntry} onWrite={onWrite} onMood={onMood} />}
    </Sheet>
  );
}

function DayBody({ date, onlyIds, onClose, onOpenEntry, onWrite, onMood }) {
  const entries = useLiveQuery(
    () => db.entries.where('date').equals(date).sortBy('createdAt'),
    [date],
    null,
  );
  const day = useLiveQuery(() => db.days.get(date), [date]);
  const mood = moodById(day?.mood);
  const shown = (entries ?? []).filter((e) => !onlyIds || onlyIds.includes(e.id));

  return (
    <>
      <div className="sheet-head">
        <div>
          <h2 className="serif">{formatLong(date)}</h2>
          {relativeLabel(date) && <div className="muted small">{relativeLabel(date)}</div>}
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <CloseIcon size={20} />
        </button>
      </div>
      <div className="sheet-scroll">
        <button className="mood-row" onClick={() => onMood(date)}>
          {mood ? (
            <>
              <span className="mood-emoji-sm">{mood.emoji}</span> Felt {mood.label.toLowerCase()}
              <span className="muted small">Change</span>
            </>
          ) : (
            <>
              <span className="mood-emoji-sm faded">🙂</span> Add a mood for this day
            </>
          )}
        </button>
        {entries && shown.length === 0 && <div className="empty-small">Nothing written on this day yet.</div>}
        {shown.map((e) => (
          <EntryCard key={e.id} entry={e} onOpen={onOpenEntry} />
        ))}
        <button className="add-own" onClick={() => onWrite(date)}>
          <PenIcon size={18} /> Write for this day
        </button>
      </div>
    </>
  );
}
