import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MediaImage } from './Media.jsx';
import { CheckIcon, CloseIcon } from './Icons.jsx';
import { useMediaUrl } from '../lib/useMediaUrl.js';
import { WEEKDAY_SHORT, formatShort, monthOf, monthWeeks } from '../lib/dates.js';
import { cloudWords } from '../lib/cloud.js';
import { renderSlideImage, shareImage } from '../lib/shareImage.js';

export const SLIDE_TYPES = ['moments', 'showedUp', 'felt', 'words', 'highlight'];

export function WordCloud({ words, seed, scale = 1 }) {
  const items = useMemo(() => cloudWords(words, seed), [words, seed]);
  if (!items.length) return <p className="muted center">Write a few lines and your words will bloom here.</p>;
  return (
    <div className="word-cloud">
      {items.map((w) => (
        <span
          key={w.word}
          className="serif"
          style={{ fontSize: `${(15 + w.size * 30) * scale}px`, color: w.color, opacity: 0.65 + w.size * 0.35 }}
        >
          {w.word}
        </span>
      ))}
    </div>
  );
}

function Moments({ r }) {
  const tiles = r.media.slice(0, 6);
  return (
    <div className="slide-inner">
      <div className="slide-kicker">{r.label}</div>
      <h2 className="slide-title serif">Your {r.noun} in moments</h2>
      {tiles.length > 0 && (
        <div className={`collage n${tiles.length}`}>
          {tiles.map((id) => (
            <span key={id} className="collage-tile">
              <MediaImage id={id} />
            </span>
          ))}
        </div>
      )}
      {r.first && (
        <div className="quote-block">
          <p className="muted">You started your {r.noun} with</p>
          <p className="serif quote">“{r.first.text}”</p>
          {r.last && (
            <>
              <p className="muted">…and ended it with</p>
              <p className="serif quote">“{r.last.text}”</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ShowedUp({ r }) {
  return (
    <div className="slide-inner center-col">
      <div className="slide-kicker">{r.label}</div>
      <h2 className="slide-title big serif">
        You showed up {r.daysCount} {r.daysCount === 1 ? 'day' : 'days'}
      </h2>
      {r.kind === 'week' ? (
        <div className="week-row slide-week">
          {r.dayKeys.map((k, i) => (
            <div key={k} className={`week-day ${r.written.has(k) ? 'done' : ''}`}>
              <span className="dot">{r.written.has(k) && <CheckIcon size={16} />}</span>
              <span className="label">{WEEKDAY_SHORT[i]}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mini-month">
          {monthWeeks(monthOf(r.start))
            .flat()
            .map((k, i) => (
              <span key={k ?? `b${i}`} className={k ? (r.written.has(k) ? 'on' : '') : 'blank'} />
            ))}
        </div>
      )}
      {r.streak > 0 && <div className="slide-pill">🔥 {r.streak} day streak</div>}
      <p className="serif slide-kind">Consistency over perfection. Every page counts.</p>
    </div>
  );
}

function Felt({ r }) {
  return (
    <div className="slide-inner center-col">
      <div className="slide-kicker">{r.label}</div>
      <h2 className="slide-title serif">How your {r.noun} felt</h2>
      {r.kind === 'week' ? (
        <div className="felt-row">
          {r.dayKeys.map((k, i) => {
            const m = r.moods[i];
            return (
              <div key={k} className="felt-day">
                <span className="felt-emoji" style={m ? { background: `${m.color}33` } : undefined}>
                  {m ? m.emoji : '·'}
                </span>
                <span className="label">{WEEKDAY_SHORT[i]}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mood-bars">
          {r.moodCounts.slice(0, 5).map(({ mood, count }) => (
            <div key={mood.id} className="mood-bar">
              <span className="mood-emoji-sm">{mood.emoji}</span>
              <span className="bar">
                <span style={{ width: `${(count / r.moodCounts[0].count) * 100}%`, background: mood.color }} />
              </span>
              <span className="small">{count}</span>
            </div>
          ))}
        </div>
      )}
      {r.primaryMood ? (
        <div className="primary-mood">
          <p className="muted">Mostly</p>
          <div className="primary-emoji">{r.primaryMood.emoji}</div>
          <p className="serif primary-label">{r.primaryMood.label}</p>
        </div>
      ) : (
        <p className="muted center slide-note">No moods logged this {r.noun}, and that’s okay.</p>
      )}
    </div>
  );
}

function Words({ r }) {
  return (
    <div className="slide-inner center-col">
      <div className="slide-kicker">{r.label}</div>
      <h2 className="slide-title serif">Your {r.noun} in words</h2>
      <WordCloud words={r.words} seed={r.id} />
    </div>
  );
}

function HighlightMedia({ id }) {
  const { url, type } = useMediaUrl(id, 'full');
  if (!url) return null;
  return type === 'video' ? (
    <video className="hl-media" src={url} autoPlay muted loop playsInline />
  ) : (
    <img className="hl-media" src={url} alt="" />
  );
}

function Highlight({ r }) {
  const e = r.highlight;
  if (!e) return null;
  const media = e.mediaIds?.[0];
  return (
    <div className={`slide-inner highlight ${media ? 'with-media' : ''}`}>
      {media && (
        <>
          <HighlightMedia id={media} />
          <span className="hl-scrim" />
        </>
      )}
      <div className="hl-text">
        <div className="slide-kicker">A favorite moment · {formatShort(e.date)}</div>
        <h2 className="slide-title serif">{e.prompt ?? 'Free write'}</h2>
        <div className="hl-lines">
          {e.lines.slice(0, 4).map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

const SLIDES = { moments: Moments, showedUp: ShowedUp, felt: Felt, words: Words, highlight: Highlight };
const BG = { moments: 'bg-dark', showedUp: 'bg-pastel', felt: 'bg-dusk', words: 'bg-dark', highlight: 'bg-pastel' };

export default function RecapViewer({ recap, onClose }) {
  const slides = SLIDE_TYPES;
  const [index, setIndex] = useState(0);
  const [images, setImages] = useState({}); // pre-rendered share images, so Share responds instantly
  const [sharing, setSharing] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => (alive.current = false), []);

  const type = slides[index];
  useEffect(() => {
    if (images[type]) return;
    renderSlideImage(recap, type)
      .then((blob) => alive.current && setImages((m) => ({ ...m, [type]: blob })))
      .catch((err) => console.warn('share image failed', err));
  }, [recap, type, images]);

  const next = () => (index < slides.length - 1 ? setIndex(index + 1) : onClose());
  const prev = () => setIndex(Math.max(0, index - 1));
  const onTap = (e) => {
    const x = e.clientX / window.innerWidth;
    if (x < 0.3) prev();
    else next();
  };

  const share = async (e) => {
    e.stopPropagation();
    const blob = images[type];
    if (!blob || sharing) return;
    setSharing(true);
    try {
      await shareImage(blob, `glimmer-${recap.kind}-${recap.start}-${index + 1}.jpg`);
    } finally {
      setSharing(false);
    }
  };

  const Slide = SLIDES[type];
  return createPortal(
    <div className={`story ${type === 'highlight' && recap.highlight?.mediaIds?.length ? 'bg-dark' : BG[type]}`} role="dialog" aria-modal="true" aria-label={`${recap.label} recap`}>
      <div className="story-top">
        <div className="story-progress">
          {slides.map((s, i) => (
            <span key={s} className={i <= index ? 'on' : ''} />
          ))}
        </div>
        <div className="story-head">
          <span className="story-brand">Glimmer · {recap.kind === 'week' ? 'Weekly' : 'Monthly'} recap</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close recap">
            <CloseIcon size={22} />
          </button>
        </div>
      </div>
      <div className="story-body" onClick={onTap} key={type}>
        <Slide r={recap} />
      </div>
      <div className="story-foot">
        <button className="story-btn ghost" onClick={share} disabled={!images[type] || sharing}>
          {images[type] ? 'Share' : 'Preparing…'}
        </button>
        <button className="story-btn" onClick={next}>
          {index < slides.length - 1 ? 'Next' : 'Done'}
        </button>
      </div>
    </div>,
    document.body,
  );
}

