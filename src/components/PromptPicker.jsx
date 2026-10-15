import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Sheet from './Sheet.jsx';
import Toggle from './Toggle.jsx';
import { db, uid, useSetting } from '../lib/db.js';
import { dailyPrompt } from '../lib/daily.js';
import { CATEGORIES } from '../data/prompts.js';
import { CloseIcon, PenIcon, PlusIcon, SearchIcon, ShuffleIcon, SparkleIcon, StarIcon, TrashIcon } from './Icons.jsx';

const TAB_KEY = 'glimmer.pickerTab';
const byId = new Intl.Collator(undefined, { numeric: true }).compare;
const readTab = () => {
  try {
    return localStorage.getItem(TAB_KEY) || 'gratitude';
  } catch {
    return 'gratitude';
  }
};

export default function PromptPicker({ open, onClose, onPick, currentId, z }) {
  return (
    <Sheet open={open} onClose={onClose} label="Choose a prompt" className="picker" z={z}>
      <PickerBody onClose={onClose} onPick={onPick} currentId={currentId} />
    </Sheet>
  );
}

function PickerBody({ onClose, onPick, currentId }) {
  const prompts = useLiveQuery(() => db.prompts.toArray(), [], []);
  const [dailyOn, setDailyOn] = useSetting('dailyPrompt', true);
  const [tab, setTabState] = useState(readTab);
  const [query, setQuery] = useState('');
  const [surprise, setSurprise] = useState(null);
  const [draft, setDraft] = useState(null); // {id?, text} while adding/editing a custom prompt

  const setTab = (t) => {
    setTabState(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* private mode */
    }
  };

  const today = useMemo(() => dailyPrompt(prompts), [prompts]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (tab === 'custom' && !q) return prompts.filter((p) => p.custom).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    const sorted = [...prompts].sort((a, b) => byId(a.id, b.id));
    if (q) return sorted.filter((p) => p.text.toLowerCase().includes(q));
    if (tab === 'favorites') return sorted.filter((p) => p.favorite);
    return sorted.filter((p) => p.category === tab);
  }, [prompts, tab, query]);

  const shuffle = () => {
    const pool = prompts.filter((p) => p.id !== currentId && p.id !== surprise?.id);
    if (pool.length) setSurprise(pool[Math.floor(Math.random() * pool.length)]);
  };

  const toggleFav = (p) => db.prompts.update(p.id, { favorite: !p.favorite });

  const saveDraft = async () => {
    const text = draft.text.trim();
    if (!text) return setDraft(null);
    if (draft.id) await db.prompts.update(draft.id, { text });
    else await db.prompts.add({ id: uid(), text, category: 'custom', custom: true, favorite: false, createdAt: Date.now() });
    setDraft(null);
    setTab('custom');
    setQuery('');
  };

  const remove = async (p) => {
    if (window.confirm(`Delete this prompt?\n\n"${p.text}"\n\nEntries you already wrote with it are kept.`)) {
      await db.prompts.delete(p.id);
    }
  };

  return (
    <>
      <div className="sheet-head">
        <h2 className="serif">Choose a prompt</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <CloseIcon size={20} />
        </button>
      </div>

      <div className="picker-top">
        <label className="search">
          <SearchIcon size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search prompts"
            enterKeyHint="search"
          />
        </label>
        <div className="picker-actions">
          <button className="chip chip-strong" onClick={shuffle}>
            <ShuffleIcon size={16} /> Surprise me
          </button>
          <button className="chip" onClick={() => onPick(null)}>
            <PenIcon size={16} /> Free write
          </button>
          <button className="chip" onClick={() => setDraft({ text: '' })}>
            <PlusIcon size={16} /> My own
          </button>
        </div>
      </div>

      <div className="sheet-scroll">
        {draft && (
          <div className="card draft-card">
            <div className="eyebrow">{draft.id ? 'Edit your prompt' : 'Add my own prompt'}</div>
            <textarea
              className="serif draft-input"
              rows={2}
              autoFocus
              value={draft.text}
              placeholder="e.g. What made me feel at home today?"
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            />
            <div className="row-end">
              <button className="btn-text" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button className="btn-small" onClick={saveDraft} disabled={!draft.text.trim()}>
                Save prompt
              </button>
            </div>
          </div>
        )}

        {surprise && (
          <div className="card gradient-card surprise">
            <div className="eyebrow">How about…</div>
            <p className="serif prompt-big">{surprise.text}</p>
            <div className="row-end">
              <button className="btn-ghost-dark" onClick={shuffle}>
                <ShuffleIcon size={16} /> Another
              </button>
              <button className="btn-dark" onClick={() => onPick(surprise)}>
                Use this
              </button>
            </div>
          </div>
        )}

        {dailyOn && today && !query && !surprise && (
          <button className="card gradient-card today-prompt" onClick={() => onPick(today)}>
            <div className="eyebrow">
              <SparkleIcon size={12} /> Today’s prompt
            </div>
            <p className="serif prompt-big">{today.text}</p>
          </button>
        )}

        {!query && (
          <div className="tabs-scroll" role="tablist">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={tab === c.id}
                className={`tab-chip ${tab === c.id ? 'active' : ''}`}
                onClick={() => setTab(c.id)}
              >
                {c.id === 'favorites' && <StarIcon size={14} filled={tab === c.id} />}
                {c.label}
              </button>
            ))}
          </div>
        )}

        <ul className="prompt-list">
          {list.map((p) => (
            <li key={p.id} className={`prompt-row ${p.id === currentId ? 'current' : ''}`}>
              <button className="prompt-text serif" onClick={() => onPick(p)}>
                {p.text}
              </button>
              {p.custom && (
                <>
                  <button className="icon-btn small" aria-label="Edit prompt" onClick={() => setDraft({ id: p.id, text: p.text })}>
                    <PenIcon size={17} />
                  </button>
                  <button className="icon-btn small" aria-label="Delete prompt" onClick={() => remove(p)}>
                    <TrashIcon size={17} />
                  </button>
                </>
              )}
              <button
                className={`icon-btn small star ${p.favorite ? 'on' : ''}`}
                aria-label={p.favorite ? 'Remove from favorites' : 'Add to favorites'}
                onClick={() => toggleFav(p)}
              >
                <StarIcon size={19} filled={p.favorite} />
              </button>
            </li>
          ))}
        </ul>

        {list.length === 0 && (
          <div className="empty-small">
            {query
              ? 'No prompts match that search.'
              : tab === 'favorites'
                ? 'Tap the ☆ next to any prompt to keep it here.'
                : 'Prompts you write yourself live here.'}
          </div>
        )}

        {tab === 'custom' && !query && !draft && (
          <button className="add-own" onClick={() => setDraft({ text: '' })}>
            <PlusIcon size={18} /> Add my own prompt
          </button>
        )}

        <div className="toggle-row">
          <div>
            <div>Suggest a new prompt every day</div>
            <div className="muted small">Shows a fresh prompt on Home each morning</div>
          </div>
          <Toggle checked={dailyOn} onChange={setDailyOn} label="Suggest a new prompt every day" />
        </div>
      </div>
    </>
  );
}
