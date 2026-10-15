import { useLayoutEffect, useRef, useState } from 'react';
import Sheet from './Sheet.jsx';
import PromptPicker from './PromptPicker.jsx';
import { MediaThumb, MediaViewer } from './Media.jsx';
import { CameraIcon, ChevronDown, CloseIcon, ImageIcon, ListIcon, ParagraphIcon, PlusIcon } from './Icons.jsx';
import { db, saveEntry } from '../lib/db.js';
import { formatShort, relativeLabel, todayKey } from '../lib/dates.js';
import { MAX_MEDIA, importFile } from '../lib/media.js';

function AutoTextarea({ value, onChange, className, ...rest }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} onChange={(e) => onChange(e.target.value)} className={className} {...rest} />;
}

/**
 * `session` = { key, entry?, prompt?, date? }. A new entry starts with 3 numbered lines.
 */
export default function EntryEditor({ session, onClose, onSaved }) {
  return (
    <Sheet open={!!session} onClose={() => {}} full className="editor" label="Journal entry" z={60}>
      {session && <EditorBody key={session.key} session={session} onClose={onClose} onSaved={onSaved} />}
    </Sheet>
  );
}

function EditorBody({ session, onClose, onSaved }) {
  const existing = session.entry ?? null;
  const [date, setDate] = useState(existing?.date ?? session.date ?? todayKey());
  const [prompt, setPrompt] = useState(
    existing ? (existing.prompt ? { id: existing.promptId, text: existing.prompt } : null) : (session.prompt ?? null),
  );
  const [mode, setMode] = useState(existing?.mode ?? 'lines');
  const [lines, setLines] = useState(() => {
    if (existing?.mode === 'lines') return existing.lines.length >= 3 ? existing.lines : [...existing.lines, '', '', ''].slice(0, 3);
    return ['', '', ''];
  });
  const [para, setPara] = useState(existing?.mode === 'paragraph' ? (existing.lines[0] ?? '') : '');
  const [mediaIds, setMediaIds] = useState(existing?.mediaIds ?? []);
  const [pending, setPending] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [viewerAt, setViewerAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const added = useRef(new Set());
  const removed = useRef(new Set());
  const dirty = useRef(false);
  const touch = () => (dirty.current = true);

  const rel = relativeLabel(date);

  const switchMode = (m) => {
    if (m === mode) return;
    if (m === 'paragraph') setPara(lines.filter((l) => l.trim()).join('\n\n'));
    else {
      const parts = para.split(/\n+/).filter((l) => l.trim());
      setLines(parts.length >= 3 ? parts : [...parts, '', '', ''].slice(0, 3));
    }
    setMode(m);
  };

  const onFiles = async (e) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    const room = MAX_MEDIA - mediaIds.length - pending;
    if (files.length > room) {
      window.alert(room > 0 ? `You can add ${room} more (up to ${MAX_MEDIA} per entry).` : `Up to ${MAX_MEDIA} photos or videos per entry.`);
    }
    touch();
    // One at a time keeps memory low on the phone.
    for (const file of files.slice(0, Math.max(0, room))) {
      setPending((n) => n + 1);
      try {
        const id = await importFile(file, { confirmLarge: (msg) => Promise.resolve(window.confirm(msg)) });
        if (id) {
          added.current.add(id);
          setMediaIds((m) => [...m, id]);
        }
      } catch (err) {
        window.alert(err?.message?.includes('too large') ? err.message : 'Sorry, that file couldn’t be added.');
      } finally {
        setPending((n) => n - 1);
      }
    }
  };

  const removeMedia = (id) => {
    touch();
    setMediaIds((m) => m.filter((x) => x !== id));
    if (added.current.has(id)) {
      added.current.delete(id);
      db.media.delete(id);
    } else removed.current.add(id);
  };

  const cancel = async () => {
    if (dirty.current && !window.confirm('Discard this entry?')) return;
    if (added.current.size) await db.media.bulkDelete([...added.current]);
    onClose();
  };

  const done = async () => {
    if (pending || saving) return;
    const text = mode === 'lines' ? lines.map((l) => l.trim()).filter(Boolean) : [para.trim()].filter(Boolean);
    if (!text.length && !mediaIds.length) {
      if (existing) {
        if (!window.confirm('This entry is empty now. Delete it?')) return;
        await db.media.bulkDelete(existing.mediaIds ?? []);
        await db.entries.delete(existing.id);
      }
      onClose();
      return;
    }
    setSaving(true);
    const row = await saveEntry({
      ...(existing ?? {}),
      date,
      prompt: prompt?.text ?? null,
      promptId: prompt?.id ?? null,
      lines: text,
      mode,
      mediaIds,
    });
    if (removed.current.size) await db.media.bulkDelete([...removed.current]);
    onSaved(row, !existing);
  };

  return (
    <>
      <header className="editor-bar">
        <button className="icon-btn" onClick={cancel} aria-label="Cancel">
          <CloseIcon size={22} />
        </button>
        <label className="date-btn">
          <span className="serif">{formatShort(date)}</span>
          <ChevronDown size={16} />
          <input
            type="date"
            value={date}
            max={todayKey()}
            aria-label="Entry date"
            onChange={(e) => {
              if (e.target.value) {
                setDate(e.target.value);
                touch();
              }
            }}
          />
        </label>
        <button className="btn-done" onClick={done} disabled={pending > 0 || saving}>
          Done
        </button>
      </header>

      <div className="sheet-scroll editor-body">
        <div className="editor-when muted small">{rel ?? 'Writing for a past day'}</div>

        <button className="editor-prompt serif" onClick={() => setPickerOpen(true)}>
          {prompt?.text ?? 'Free write'}
          <span className="change">{prompt ? 'Change prompt' : 'Pick a prompt'}</span>
        </button>

        <div className="segmented" role="tablist" aria-label="Writing style">
          <button role="tab" aria-selected={mode === 'lines'} className={mode === 'lines' ? 'on' : ''} onClick={() => switchMode('lines')}>
            <ListIcon size={16} /> Lines
          </button>
          <button
            role="tab"
            aria-selected={mode === 'paragraph'}
            className={mode === 'paragraph' ? 'on' : ''}
            onClick={() => switchMode('paragraph')}
          >
            <ParagraphIcon size={16} /> Paragraph
          </button>
        </div>

        {mode === 'lines' ? (
          <div className="lines">
            {lines.map((l, i) => (
              <div className="line" key={i}>
                <span className="line-num serif">{i + 1}</span>
                <AutoTextarea
                  value={l}
                  placeholder={i === 0 ? 'Start writing…' : ''}
                  onChange={(v) => {
                    touch();
                    setLines((ls) => ls.map((x, j) => (j === i ? v : x)));
                  }}
                />
              </div>
            ))}
            <button className="add-line" onClick={() => setLines((ls) => [...ls, ''])}>
              <PlusIcon size={16} /> Add line
            </button>
          </div>
        ) : (
          <AutoTextarea
            className="para"
            value={para}
            placeholder="Let it all out…"
            onChange={(v) => {
              touch();
              setPara(v);
            }}
          />
        )}

        {(mediaIds.length > 0 || pending > 0) && (
          <div className="media-grid">
            {mediaIds.map((id, i) => (
              <div className="media-cell" key={id}>
                <MediaThumb id={id} onClick={() => setViewerAt(i)} />
                <button className="media-remove" onClick={() => removeMedia(id)} aria-label="Remove">
                  <CloseIcon size={14} />
                </button>
              </div>
            ))}
            {Array.from({ length: pending }, (_, i) => (
              <div className="media-cell" key={`p${i}`}>
                <div className="media-thumb loading">
                  <span className="spinner" />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="media-buttons">
          <label className={`media-btn ${mediaIds.length + pending >= MAX_MEDIA ? 'disabled' : ''}`}>
            <ImageIcon size={20} /> Photos/Videos
            <input type="file" accept="image/*,video/*" multiple onChange={onFiles} disabled={mediaIds.length + pending >= MAX_MEDIA} />
          </label>
          <label className={`media-btn ${mediaIds.length + pending >= MAX_MEDIA ? 'disabled' : ''}`}>
            <CameraIcon size={20} /> Camera
            <input
              type="file"
              accept="image/*,video/*"
              capture="environment"
              onChange={onFiles}
              disabled={mediaIds.length + pending >= MAX_MEDIA}
            />
          </label>
        </div>
        <div className="muted small center">
          {mediaIds.length}/{MAX_MEDIA} · photos and videos stay on this phone
        </div>
      </div>

      <PromptPicker
        open={pickerOpen}
        z={70}
        currentId={prompt?.id}
        onClose={() => setPickerOpen(false)}
        onPick={(p) => {
          touch();
          setPrompt(p);
          setPickerOpen(false);
        }}
      />
      {viewerAt != null && <MediaViewer ids={mediaIds} start={viewerAt} onClose={() => setViewerAt(null)} />}
    </>
  );
}
