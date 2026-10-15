import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Sheet from './Sheet.jsx';
import { EntryLines } from './EntryCard.jsx';
import { MediaThumb, MediaViewer } from './Media.jsx';
import { BookmarkIcon, CloseIcon, PenIcon, TrashIcon } from './Icons.jsx';
import { db, deleteEntry } from '../lib/db.js';
import { formatLong } from '../lib/dates.js';

export default function EntryViewer({ entryId, onClose, onEdit }) {
  return (
    <Sheet open={!!entryId} onClose={onClose} label="Entry" className="viewer-sheet" z={55}>
      {entryId && <ViewerBody entryId={entryId} onClose={onClose} onEdit={onEdit} />}
    </Sheet>
  );
}

function ViewerBody({ entryId, onClose, onEdit }) {
  const entry = useLiveQuery(() => db.entries.get(entryId), [entryId]);
  const [viewerAt, setViewerAt] = useState(null);
  if (!entry) return <div className="sheet-scroll" />;

  const remove = async () => {
    if (!window.confirm('Delete this entry and its photos/videos? This can’t be undone.')) return;
    await deleteEntry(entry.id);
    onClose();
  };

  return (
    <>
      <div className="sheet-head">
        <h2 className="serif">{formatLong(entry.date)}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <CloseIcon size={20} />
        </button>
      </div>
      <div className="sheet-scroll">
        <h3 className="serif viewer-prompt">{entry.prompt ?? 'Free write'}</h3>
        <EntryLines entry={entry} />
        {entry.mediaIds?.length > 0 && (
          <div className="media-grid">
            {entry.mediaIds.map((id, i) => (
              <div className="media-cell" key={id}>
                <MediaThumb id={id} onClick={() => setViewerAt(i)} />
              </div>
            ))}
          </div>
        )}
        <div className="viewer-actions">
          <button
            className={`action ${entry.bookmarked ? 'on' : ''}`}
            onClick={() => db.entries.update(entry.id, { bookmarked: !entry.bookmarked })}
          >
            <BookmarkIcon size={20} filled={entry.bookmarked} />
            {entry.bookmarked ? 'Saved' : 'Save'}
          </button>
          <button className="action" onClick={() => onEdit(entry)}>
            <PenIcon size={20} /> Edit
          </button>
          <button className="action danger" onClick={remove}>
            <TrashIcon size={20} /> Delete
          </button>
        </div>
      </div>
      {viewerAt != null && <MediaViewer ids={entry.mediaIds} start={viewerAt} onClose={() => setViewerAt(null)} />}
    </>
  );
}
