import { MediaThumb } from './Media.jsx';
import { BookmarkIcon } from './Icons.jsx';

export function EntryLines({ entry, clamp }) {
  if (entry.mode === 'paragraph') {
    return <p className={`entry-para ${clamp ? 'clamp' : ''}`}>{entry.lines[0]}</p>;
  }
  const lines = clamp ? entry.lines.slice(0, 3) : entry.lines;
  return (
    <ol className="entry-lines">
      {lines.map((l, i) => (
        <li key={i} className={clamp ? 'clamp1' : ''}>
          <span className="line-num serif">{i + 1}</span>
          <span>{l}</span>
        </li>
      ))}
      {clamp && entry.lines.length > 3 && <li className="muted small more">+{entry.lines.length - 3} more</li>}
    </ol>
  );
}

export default function EntryCard({ entry, onOpen }) {
  const media = entry.mediaIds ?? [];
  const shown = media.slice(0, 4);
  return (
    <article className="card entry-card" onClick={() => onOpen(entry)} role="button" tabIndex={0}>
      <div className="entry-card-head">
        <h3 className="serif entry-prompt">{entry.prompt ?? 'Free write'}</h3>
        {entry.bookmarked && <BookmarkIcon size={16} filled className="saved-mark" />}
      </div>
      {entry.lines.length > 0 && <EntryLines entry={entry} clamp />}
      {shown.length > 0 && (
        <div className="thumb-row">
          {shown.map((id, i) => (
            <MediaThumb key={id} id={id} className="small">
              {i === 3 && media.length > 4 && <span className="more-overlay">+{media.length - 4}</span>}
            </MediaThumb>
          ))}
        </div>
      )}
    </article>
  );
}
